# Statify handoff context

This file describes the repository as it exists after DEV-18. It is meant to give another developer or coding agent enough context to continue with the next ticket without reconstructing the project from scratch.

## Current state

- Repository: `dev-ahad-ali/statify`
- Active working branch: `staging`
- Latest staging commit: `e5e45b8 feat: serve SDK and add install snippets`
- API runtime: Express on a Cloudflare Worker through `cloudflare:node` and `httpServerHandler`
- Web runtime: Next.js static export deployed to Cloudflare Pages
- Database: Cloudflare D1
- Cache: Cloudflare KV
- Package manager: Bun 1.4.0
- Monorepo runner: Turborepo

The current Linear workspace has completed tickets DEV-5 through DEV-18. DEV-19 is the next implementation ticket. The CLI audit did not find issues DEV-1 through DEV-4 in the current workspace, so do not assume those identifiers are available when linking future work.

## Repository layout

```text
apps/api/                 Express API Worker, D1 migrations, seed data
apps/web/                 Next.js app, static Pages output, Pages API proxy
packages/sdk/             Browser snippet and server middleware
packages/shared/          Zod schemas, TypeScript types, rollup constants, snippets
.github/workflows/        Pull request, staging, and production workflows
```

The API and web apps do not import each other at runtime. Both use contracts from `@statify/shared`. The SDK imports the shared ingest types and is built before the web app when Turbo runs the web build.

## Deployment model

The frontend is on Cloudflare Pages. It is not an OpenNext or frontend Worker deployment.

| Environment | Web | API Worker | Pages project | API environment |
| --- | --- | --- | --- | --- |
| Staging | `https://statify-staging.pages.dev` | `https://statify-api-staging.ahadali-dev.workers.dev` | `statify-staging` | `staging` |
| Production | `https://statify-app.pages.dev` | `https://statify-api-prod.ahadali-dev.workers.dev` | `statify-app` | `prod` |

`apps/web/next.config.js` sets `output: "export"`. Next writes the static site to `apps/web/out`. `apps/web/wrangler.jsonc` and `apps/web/wrangler.staging.jsonc` set `pages_build_output_dir` to `./out` and contain the environment URLs.

The Pages Function at `apps/web/functions/api/[[path]].ts` proxies `/api/*` to the API Worker. It copies request headers, including cookies, forwards the request body for non-GET methods, and returns the upstream status, headers, and body. This keeps dashboard authentication cookies first-party on the Pages origin.

The Pages static headers file at `apps/web/public/_headers` sets:

```text
/statify.js
  Cache-Control: public, max-age=3600
```

### CI and deployment

`.github/workflows/staging.yml` runs on pushes to `staging`. `.github/workflows/prod.yml` runs on pushes to `main`. Both workflows:

1. Install Bun dependencies.
2. Run the root typecheck job first.
3. Apply remote D1 migrations and deploy the API Worker.
4. Run `bun run build --filter=web` from the repository root. This builds the SDK first and then the static Next app.
5. Deploy `apps/web/out` with `wrangler pages deploy` to the correct Pages project.

The API jobs use `wrangler deploy --env staging` or `--env prod`. The web jobs use the Pages-specific Wrangler command. Do not change the web job back to `wrangler deploy` or OpenNext unless the deployment architecture is intentionally redesigned.

The pull request workflow checks root typechecking and requires `staging` as the source branch for pull requests into `main`. GitHub branch protection was configured separately for `main`.

## API architecture

The API is intentionally modular. Each feature owns its routes, controllers, services, and repository code.

```text
apps/api/src/app.ts
  /health    features/health/health.routes.ts
  /auth      features/auth/{auth.routes,auth.controller,auth.service,auth.repository}.ts
  /projects  features/projects/{projects.routes,projects.controller,projects.service,projects.repository}.ts
  /ingest    features/ingest/{ingest.routes,ingest.controller,ingest.service,ingest.repository,rollup.service}.ts
```

`apps/api/src/index.ts` starts Express on port 8787 and exports `httpServerHandler({ port: 8787 })` for Workers. `apps/api/src/config/env.ts` reads the D1, KV, environment, web URL, and secret bindings.

Responses use the helpers in `apps/api/src/lib/response.ts`. Authentication is handled by `requireAuth` in the auth feature and adds `req.userId` to the Express request.

### Authentication

- Passwords use Web Crypto PBKDF2-SHA256 with a random 16-byte salt and 100,000 iterations.
- Password storage is `saltHex:hashHex`.
- `jose` signs HS256 access and refresh JWTs with separate secrets.
- Access tokens expire after 15 minutes.
- Refresh tokens expire after 30 days and are stored in D1 by SHA-256 hash.
- Refresh rotation replaces the old stored token hash. Reuse or expiry invalidates the user's refresh tokens.
- Cookies are HTTP-only, `sameSite=lax`, secure outside development, path `/`, and use max ages matching the JWT lifetimes.
- Routes are signup, login, refresh, logout, forgot, reset, and authenticated `/auth/me`.
- Reset tokens are random 32-byte values. Only their hashes are stored in D1, and they expire after 30 minutes.

Required local API values are documented in `apps/api/.dev.vars.example`. Copy it to `apps/api/.dev.vars` for local work. Real `.dev.vars` files are ignored by the repository.

Required secret names are:

```text
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_SECRET
RESEND_API_KEY
PSI_API_KEY
```

`WEB_URL` is a non-secret variable. Use `http://localhost:3000` locally, `https://statify-staging.pages.dev` in staging, and `https://statify-app.pages.dev` in production.

### Projects and API keys

Projects belong to a user and contain a normalized domain, optional allowed domains, an active flag, and a public browser API key. Current keys use the `sf_` prefix followed by 64 random hexadecimal characters.

Project operations:

- List projects for the authenticated user.
- Create a project.
- Rename a project.
- Add or replace allowed domains.
- Rotate the API key.
- Soft-delete a project.

API-key lookups use KV first and D1 as the fallback. Project ownership queries include `owner_id`. Domain allow-list changes and key rotation invalidate the relevant KV entry.

### Ingest flow

`POST /ingest` accepts text or JSON content, although the browser SDK deliberately sends `text/plain` to avoid a CORS preflight.

1. The controller reads the raw body and calls `JSON.parse`.
2. `@statify/shared` validates the API key, context, and a batch of 1 to 50 events.
3. The project is loaded from KV or D1.
4. Browser events require an `Origin` whose hostname matches the project domain or an allowed domain.
5. Server events use `source: "server"` and skip the browser Origin check. A batch cannot mix browser and server events.
6. Cloudflare request properties provide country, region, city, and timezone.
7. `ua-parser-js` provides browser, OS, and device values.
8. The API does not store the request IP.
9. `waitUntil` queues the D1 write and the endpoint returns `202` before the write finishes.

The ingest route allows `POST` and `OPTIONS`, sets `Access-Control-Allow-Origin: *`, and accepts `Content-Type: text/plain` and `application/json`.

### D1 schema and rollups

Migrations are in `apps/api/migrations`:

- `0001_auth.sql`: users, refresh tokens, reset tokens.
- `0002_projects.sql`: projects, API keys, allowed domains, ownership indexes.
- `0003_events.sql`: raw event rows and enrichment columns, including agent metadata and source.
- `0004_rollups.sql`: daily stats, pages, referrers, countries, regions, cities, browsers, OS, devices, agents, visitors, and sessions.
- `0005_audits.sql`: audit scores, field metrics, and raw audit JSON.

`packages/shared/src/rollups.ts` owns the rollup table and column names. The ingest rollup writer uses these constants instead of duplicating column strings.

Each incoming event is inserted into `events`. `page_view` events also create rollup statements. Raw event inserts and rollup statements go through one D1 `batch`, so a batch succeeds or fails together. Visitor and session dedupe tables support daily unique counts. If the client timestamp is more than 24 hours away from receipt time, rollups use the receipt date.

Rollup failures run inside `waitUntil`, are caught, and are logged with the project ID and batch size. The free D1 write budget is the main scale limit. A page view currently costs roughly 12 D1 rows when all rollups are written.

## SDK behavior

### Browser SDK

The browser source is under `packages/sdk/src/browser` and is built by tsup as a minified IIFE. The build writes `packages/sdk/dist/statify.global.js` and copies it to `apps/web/public/statify.js`.

The script reads its own tag and supports:

- `data-api-key`
- `data-endpoint`
- `data-batch-size`
- `data-batch-timeout`

The default endpoint is the production API ingest URL. The visitor ID lives in `localStorage` under `sf_vid`. The session ID lives in `sessionStorage`, rolls over after 30 minutes of inactivity, and uses `crypto.randomUUID()` when available.

The tracker sends a `page_view` on load, on `popstate`, and after patched `pushState` and `replaceState` calls. A capturing document listener records clicks on the closest link or button. It records the tag, ID, class, trimmed text, and href.

Events flush when the queue reaches its configured size or its timeout. `sendBeacon` handles `visibilitychange` to hidden and `pagehide`; normal flushes use `fetch` with `keepalive` and `Content-Type: text/plain`.

The browser context includes automation hints: `navigator.webdriver`, a HeadlessChrome user-agent check, missing `window.chrome` on a Chrome user agent, and whether the page received pointer movement before the first click. The SDK currently ignores `navigator.doNotTrack`; this choice is documented in the README and should remain explicit in product copy.

### Server SDK

Server middleware is under `packages/sdk/src/server`.

- Express: `@statify/sdk/server/express`
- Next middleware helper: `@statify/sdk/server/next`

The middleware only tracks GET and HEAD requests that accept HTML and whose path does not look like a static asset. It creates a `server_request` event with the path, referrer, user agent, Accept header, and Web Bot Auth headers.

The server visitor ID is a SHA-256 digest of the IP, user agent, and current UTC date. The raw IP never leaves the server middleware. Delivery is fire-and-forget with a two-second abort timeout. Express sends after `res.on("finish")`; Next schedules delivery with `event.waitUntil`.

Server API keys must stay private. The browser key is intentionally public and can be copied by a site visitor, but a server key must not be embedded in client code.

### Install snippets

`packages/shared/src/snippets.ts` exports eight snippets through `installSnippets`:

1. HTML
2. Next.js
3. React
4. SvelteKit
5. Nuxt
6. Astro
7. Express middleware
8. Next middleware

They use the production script URL and `YOUR_API_KEY` as placeholders. DEV-24 should replace the placeholder with the selected project's actual key before displaying or copying the snippet.

## Local development

From the repository root:

```sh
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
bun run db:fresh
bun run dev:api
bun run dev:web
```

`db:fresh` removes local Wrangler D1 state, applies all migrations, and runs `apps/api/seed.sql`. The seed creates a local user and project for API testing. The local API uses the staging D1/KV shape from the top-level API Wrangler configuration, but local values and state remain local.

Useful checks:

```sh
bun run typecheck
bun run build
bun run build --filter=web
bun run db:fresh
```

The API can also be run with `bunx wrangler dev --local` from `apps/api`. When testing browser ingest manually, include a matching `Origin`. When testing server ingest, send `source: "server"` and keep the API key out of browser code.

## Completed work and next order

### Completed

- DEV-5: Express on Workers spike completed. The API keeps the Express plus `httpServerHandler` approach.
- DEV-6: Bun/Turbo monorepo, workspaces, shared contracts, root scripts, and ignore rules.
- DEV-7: Staging and production D1, KV, API Worker environments, bindings, and secrets setup.
- DEV-8: GitHub Actions for staging and production, Pages deployment, typecheck gate, and branch protection. The Linear description now correctly says Pages for the frontend.
- DEV-9: Five D1 migrations, rollup constants, seed data, and `db:fresh`.
- DEV-10: Signup, login, PBKDF2, JWT cookies, refresh token storage, and password reset email flow.
- DEV-11: Refresh rotation, logout, `/auth/me`, and modular auth middleware.
- DEV-12: Forgot/reset password through Resend, environment-specific reset links, one-use reset tokens, and refresh-session invalidation.
- DEV-13: Project CRUD, API key rotation, allowed domains, ownership checks, and KV cache.
- DEV-14: Modular ingest validation, API-key lookup, Origin validation, enrichment, and 202 response.
- DEV-15: D1 event writes, daily rollups, dedupe tables, timestamp drift handling, and visible `waitUntil` errors.
- DEV-16: Browser SDK with IDs, SPA navigation tracking, clicks, batching, beacon delivery, and automation hints.
- DEV-17: Express and Next server SDK middleware with server events and hashed visitor IDs.
- DEV-18: Pages-hosted `statify.js`, cache headers, shared install snippets, and SDK-to-web Turbo build ordering.

### Next implementation order

The remaining plan is ordered around dependencies:

1. DEV-19: finish the Next.js Pages app, Tailwind, shadcn components, and `/api` proxy verification. Do not introduce OpenNext or move the frontend to a Worker.
2. DEV-20: auth pages, route guards, and the client API wrapper with refresh-on-401.
3. DEV-21: authenticated dashboard API with range and filter queries. Keep ownership checks on `owner_id`.
4. DEV-22: dashboard shell, project switcher, range picker, summary, and visitors chart using shadcn charts and Recharts.
5. DEV-23: pages, referrers, locations, and device breakdown cards.
6. DEV-24: settings, project mutations, domains, API key rotation, install snippet picker, and delete confirmation.
7. DEV-25: seeded demo mode.
8. DEV-26: agent user-agent list and classifier.
9. DEV-27: Web Bot Auth signature verification.
10. DEV-28: agent rollups, API, dashboard section, and demo data.
11. DEV-29: PageSpeed Insights cron and manual audit trigger.
12. DEV-30: fetch-based agentic browsing score.
13. DEV-31: audit UI and history.
14. DEV-32: landing page, three.js scene, feature grid, and snippet picker.
15. DEV-33: optional real-user Web Vitals.
16. DEV-34: rate limits, retention, final security review, documentation, and production release.

## Known gaps to keep in mind

- The dashboard API and dashboard UI have not been implemented yet. The current web page is still the initial scaffold.
- The API schema already contains audit and agent rollup tables, but the agent classifier, Web Bot Auth verifier, dashboard endpoints, and audit cron are future tickets.
- DEV-17 records the planned browser/server page-view deduplication, but that logic is not implemented yet because the dashboard queries do not exist.
- Browser API keys are public by design. Origin validation limits accidental cross-site use but cannot stop a client from replaying a public key.
- `apps/web/public/statify.js` is a generated copy of the SDK bundle. The root Turbo web build regenerates it before the Pages build.
- Do not commit `.dev.vars`, `.env.local`, API tokens, JWT secrets, Resend keys, PSI keys, or Cloudflare API tokens.
- The API currently uses its own `sf_` key format. Do not rename it to the older Orbit `orb_` format without updating the project service, snippets, and tests together.

## Handoff checklist

Before starting the next ticket:

1. Confirm `git status` is clean and start from `staging`.
2. Read the Linear ticket and its latest comments.
3. Check whether the ticket changes the API Worker, the Pages site, or a shared package.
4. Preserve the Pages deployment commands and URLs above.
5. Run `bun run typecheck` and the narrowest relevant build or local test before committing.
6. Use a focused commit message, push `staging`, and update the Linear issue with the commit and verification results.
