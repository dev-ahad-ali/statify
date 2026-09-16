# Statify

Statify is a self-hosted web analytics product. It collects page views, sessions, clicks, referrers, locations, device data, AI-agent visits, Web Vitals, and site audit scores. The application runs on Cloudflare Workers, D1, KV, and Pages. There is no application server, Postgres database, or Redis instance.

## Repository layout

```text
apps/api        Express API running through Cloudflare Workers httpServerHandler
apps/web        static Next.js dashboard and landing page deployed to Pages
packages/sdk    browser snippet plus Express and Next.js server middleware
packages/shared Zod schemas, TypeScript contracts, rollup names, snippets, agent detection
```

Bun installs dependencies and runs scripts. Turborepo runs workspace tasks. Workers production code runs in the Cloudflare runtime, not in Bun.

## Local setup

```sh
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
bun run db:fresh
bun run dev:api
bun run dev:web
```

Generate long random values for `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. Add `RESEND_API_KEY` for password reset email and `PSI_API_KEY` for PageSpeed audits. Never commit either local file or a real secret.

Useful checks:

```sh
bun run typecheck
bun run lint
bun run build
bun run db:fresh
```

## Runtime flow

1. A customer site loads `statify.js` with a public project API key.
2. The browser SDK creates a persistent local-storage visitor ID and a 30-minute session ID in session storage. It sends a page view, SPA navigation events, clicks, and LCP, INP, and CLS events.
3. The SDK batches up to 10 events or waits five seconds, then posts text JSON to the API `/ingest` endpoint. `sendBeacon` is used when a page becomes hidden.
4. The API validates the payload, finds the project through KV and D1, checks the browser Origin, enriches the event with Cloudflare location and UA parser data, classifies agents, and writes raw events plus rollups in a background task.
5. The dashboard calls the API through the Pages `/api/*` proxy. The proxy keeps authentication cookies first-party.
6. The API verifies the access cookie, checks project ownership, and returns rollup-backed dashboard data. Filtered views read raw events.

## API architecture

`apps/api/src/index.ts` exports the default Express Worker handler and the scheduled handler. `apps/api/src/app.ts` mounts the feature routers. Each feature keeps routes, controllers, services, and repositories separate:

- `auth`: signup, login, refresh, logout, reset email, reset password, and `/me`.
- `projects`: owner-scoped CRUD, API-key rotation, and allowed domains.
- `ingest`: public browser/server event intake, rate limits, validation, enrichment, classification, and rollups.
- `dashboard`: owner-scoped overview and agent analytics queries.
- `audits`: PSI and agentic audit execution, audit history, field vitals, and manual runs.
- `health`: unauthenticated health response.
- `retention`: weekly deletion of raw events older than 90 days.

Repositories contain D1 SQL. Services contain validation and business rules. Controllers translate service results into the common `{ success, message, data, error }` response envelope. New API features should follow this structure instead of placing SQL or business rules in routes.

### Authentication

Passwords use PBKDF2-SHA256 with a per-user salt. The API issues a 15-minute access JWT and a 30-day refresh JWT in HttpOnly, SameSite=Lax cookies. Refresh token hashes live in D1. Refresh rotates the row and deletes the old hash. Login, refresh, and reset errors do not expose account details.

The web client calls `/auth/me` on boot. A 401 triggers one deduplicated `/auth/refresh` request shared by concurrent API calls. If refresh fails, the client redirects to login.

### Ingest

Browser requests must include an Origin matching the project domain or an allowed domain. Server SDK requests set `source: "server"` and skip the browser Origin rule. The public browser API key can be copied by visitors, so Origin validation limits accidental use but cannot stop deliberate event pollution.

The ingest rate limit is 600 requests per API key per minute in KV. Login and forgot-password are limited to 10 requests per hashed client address per minute. The D1 budget guard reserves an estimate of 12 writes per event in a UTC-day KV counter. Once the 90,000 estimated-write threshold is reached, the API stops inserting raw `events` rows and continues writing rollups.

### Scheduled jobs

The API has two cron triggers in each environment:

- `0 3 * * *`: runs mobile PSI and fetch-based agentic audits for up to 200 active projects, with a one-second gap between projects.
- `0 4 * * 0`: deletes raw events older than 90 days. Daily rollups remain.

The audit job needs the `PSI_API_KEY` Worker secret. Manual `POST /audits/:projectId/run` calls are authenticated and limited to one run per project every ten minutes through KV.

## Data model

Migrations are in `apps/api/migrations` and run in order:

- `0001_auth.sql`: users, refresh tokens, reset tokens.
- `0002_projects.sql`: projects, API keys, active flag, allowed domains.
- `0003_events.sql`: denormalised raw event rows and indexes.
- `0004_rollups.sql`: daily stats, pages, referrers, locations, browsers, OS, devices, agents, visitors, sessions.
- `0005_audits.sql`: PSI and agentic audit rows with raw JSON.
- `0006_vitals.sql`: daily LCP, INP, and CLS count and total values.

Rollup SQL names live in `packages/shared/src/rollups.ts` where possible. Keep migration columns and rollup constants aligned. A mismatch here breaks background writes without changing the 202 response.

## SDK

The browser entry is `packages/sdk/src/browser/index.ts`. It discovers its own script tag, reads `data-api-key`, creates identity IDs, tracks page views and clicks, sends Web Vitals, batches events, and flushes on page hide. It patches `pushState` and `replaceState` so client-side navigation emits a page view.

The server entry points are `@statify/sdk/server/express` and `@statify/sdk/server/next`. They only track HTML GET and HEAD requests, hash the source IP with the user agent and UTC day, and send a `server_request` event without exposing the raw IP to the API.

Build the browser bundle with:

```sh
bun run build --filter=@statify/sdk
```

The generated `packages/sdk/dist/statify.global.js` is copied to `apps/web/public/statify.js` during the workspace build.

## Web application

`apps/web` is a static Next.js export. The Pages Function at `apps/web/functions/api/[[path]].ts` proxies `/api/*` to the API Worker. `apps/web/lib/api.ts` wraps fetch, sends cookies, parses the API envelope, and refreshes expired access sessions.

The dashboard uses client components because project selection, query filters, demo mode, and API responses are interactive. The main routes are `/dashboard`, `/dashboard/agents`, `/dashboard/audits`, and `/settings`. Auth routes are `/login`, `/signup`, `/forgot`, and `/reset`. `/demo` mirrors the main dashboard without API mutations.

The landing page is `/`. It defaults to dark mode through `next-themes`, supports a light toggle, lazy-loads the hero and page background canvas scenes, and contains the install snippet picker and product sections. `apps/web/app/globals.css` owns the shadcn OKLCH theme.

## Deployment

Pushing `staging` runs `.github/workflows/staging.yml`. It installs with the locked Bun version, typechecks, applies remote D1 migrations, deploys the staging API, builds the static web app, and deploys Pages project `statify-staging`.

Pushing `main` runs `.github/workflows/prod.yml` and deploys the production API and Pages project `statify-app`.

URLs:

- Staging Pages: `https://statify-staging.pages.dev`
- Production Pages: `https://statify-app.pages.dev`
- API URLs are configured in GitHub environment variables and the web proxy configuration.

Each GitHub environment needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `API_URL`, and `NEXT_PUBLIC_WEB_URL`. Each deployed Worker also needs its own JWT, Resend, and PSI secrets. Local `.dev.vars` and `.env.local` values do not deploy.

## Adding a feature

Start by checking the shared contract and the relevant migration. Add a migration for durable data, a shared Zod/type change for cross-package payloads, a repository method for SQL, service validation, a controller, and a route. Add the client API wrapper and a focused web component if the feature is visible in the dashboard. Update demo data when the feature has a demo route. Run typecheck, lint, build, and `git diff --check` before committing.

Keep secrets out of source control. Do not use raw ownerless domain lookups for dashboard data. Use `owner_id` in every project authorization query. Keep rate limits and background errors observable when changing ingest or scheduled work.
