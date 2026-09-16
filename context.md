# Statify engineering handoff

This document describes the repository as it exists after DEV-33 and DEV-34. It is written for the next engineer or agent who needs to make a change without reconstructing the whole system first.

## Product and runtime

Statify is a privacy-first, self-hosted analytics product. A customer creates a project for a domain, receives a public browser API key, installs `statify.js`, and reads the resulting traffic in a dashboard. The product tracks page views, sessions, clicks, entry pages, referrers, country/region/city, browser/OS/device, AI-agent traffic, site audits, and real-user Web Vitals.

The runtime has no always-on server:

```text
Customer site
   │ statify.js or server SDK
   ▼
Cloudflare Worker API, Express through cloudflare:node
   ├── D1: users, projects, raw events, rollups, audits, vitals
   ├── KV: API-key cache, owner cache, rate limits, D1 budget counter
   └── cron: PSI/agentic audits and raw-event retention
   ▲
Cloudflare Pages static Next.js app
   └── /api/* Pages Function proxies to the Worker
```

Bun is the package manager and local task runner. It is not the production runtime. Turborepo runs the workspaces. TypeScript is used throughout.

## Repository map

```text
apps/api/
  src/index.ts                  Worker entry and cron handler
  src/app.ts                    Express app and router mounting
  src/config/env.ts             Worker bindings and secrets
  src/features/<feature>/       routes, controllers, services, repositories
  src/lib/                      response, crypto, rate limiting
  migrations/                   ordered D1 schema changes
  wrangler.jsonc                local, staging, and production bindings

apps/web/
  app/                          Next routes and route groups
  components/                   auth, dashboard, audits, landing, settings, UI
  lib/                          API client and typed feature clients
  functions/api/[[path]].ts     Pages-to-Worker proxy
  next.config.js                static export configuration

packages/sdk/
  src/browser/                  browser tracker, identity, batching, sender
  src/server/                   Express and Next middleware
  tsup.config.ts                browser bundle build

packages/shared/
  src/schemas.ts                Zod request schemas
  src/types.ts                  shared event and project types
  src/rollups.ts                rollup table and column constants
  src/agents.ts                 agent classifier
  src/web-bot-auth.ts           Web Bot Auth verification
  src/snippets.ts                framework install snippets
```

## API request model

`apps/api/src/app.ts` creates one Express app, installs JSON parsing with a 32 KB limit, mounts routers, returns a standard 404 envelope, and logs uncaught errors. The routers are:

```text
/health
/auth
/projects
/ingest
/dashboard
/audits
```

The default export in `apps/api/src/index.ts` uses `httpServerHandler({ port: 8787 })`. The `nodejs_compat` Wrangler flag is required. `createApp().listen(8787)` initializes Express for the Workers Node compatibility adapter.

The API uses this response shape for normal JSON endpoints:

```ts
{ success: boolean, message: string, data: unknown | null, error: string | null }
```

Ingest intentionally returns an empty `202` response after scheduling its D1 write. Browser senders only need acknowledgement and should not wait for rollup work.

### Feature module rules

Routes apply middleware and map HTTP verbs to controllers. Controllers extract request values, call services, and map known domain errors to status codes. Services parse shared Zod schemas and implement business decisions. Repositories contain hand-written prepared SQL against D1.

When adding a feature, keep SQL out of controllers. Add a migration before relying on a new table. Add a shared contract when the browser SDK and API both need to understand a payload. Add a typed client function and demo data when the feature appears in the web app.

## Authentication and authorization

Signup and login validate with shared schemas. Passwords use PBKDF2-SHA256 with a random 16-byte salt. The stored form is the salt and derived hash. JWTs use `jose` and Web Crypto with HS256:

- access token lifetime: 15 minutes
- refresh token lifetime: 30 days
- access and refresh tokens: HttpOnly, SameSite=Lax cookies
- Secure cookie flag: enabled in production
- refresh hashes: stored in D1 and rotated on every refresh

`requireAuth` reads the access cookie and verifies it. It adds `req.userId` for controllers. Every dashboard, project, audit, and agent repository query must include the authenticated owner ID. Do not authorize by domain alone.

The web client calls `/auth/me` on startup. `apps/web/lib/api.ts` retries a request once after a deduplicated `/auth/refresh`. A failed refresh redirects to `/login`. Pages proxies API calls through the web origin so the cookies stay first-party.

Auth limits are KV counters keyed by SHA-256 of the client address:

- `/auth/login`: 10 requests per minute
- `/auth/forgot`: 10 requests per minute

The client address comes from `CF-Connecting-IP`, then the first `X-Forwarded-For` value, then Express `req.ip`.

## Browser and server SDK

### Browser SDK

The browser entry starts only when it finds a script tag containing `statify.js`. It reads `data-api-key`, batch size, and batch timeout from that tag. The default endpoint is the production API Worker ingest URL.

Identity behavior:

- visitor ID is stored in localStorage under `orb_id` and does not expire
- session ID is stored in sessionStorage and rolls after 30 minutes of inactivity
- both IDs combine a base-36 timestamp and random text

Tracking behavior:

- sends a `page_view` on startup
- emits page views after `popstate`, `pushState`, and `replaceState`
- records clicks on the nearest `a` or `button`
- sends `automation` hints for webdriver, headless Chrome, and missing pointer activity
- sends LCP, INP, and CLS through `web-vitals`

Batch behavior:

- flushes at 10 events or after five seconds
- flushes on `visibilitychange` and `pagehide`
- prefers `navigator.sendBeacon` during page teardown
- uses `text/plain` to keep browser ingest a CORS simple request with no preflight

Vital events are `custom` events with `vitalName`, `vitalValue`, and `vitalRating` properties. The API keeps their aggregate in `daily_vitals`; it does not need to make the raw event schema wider.

### Server SDK

`@statify/sdk/server/express` attaches to the response `finish` event. `@statify/sdk/server/next` schedules work with `NextFetchEvent.waitUntil`. Both only track HTML GET and HEAD requests, skip static asset-looking paths, and hash the IP, user agent, and UTC date into a server visitor ID. The raw IP never enters the payload.

Server events use `source: "server"`. They may skip browser Origin validation, so their API key must remain server-side.

## Ingest pipeline

`apps/api/src/features/ingest/ingest.service.ts` performs the following steps:

1. Parses JSON and validates the shared ingest schema.
2. Rejects mixed browser/server batches.
3. Applies the 600 requests per API key per minute KV limit.
4. Looks up the active project in KV, then D1, and caches the result for one hour.
5. Validates browser `Origin` against the project domain and allowed domains.
6. Reads `request.cf` for country, region, city, and timezone.
7. Parses browser user-agent data with `ua-parser-js`.
8. Verifies Web Bot Auth when signature headers exist.
9. Classifies the request as human, crawler, agent, or automation.
10. Converts events to the internal enriched event shape.
11. Reserves an estimated D1 write budget in KV.
12. Uses `waitUntil` to write raw events and daily rollups, logging failures instead of hiding them.

The D1 budget counter uses a UTC date key and estimates 12 writes per incoming event. The 90,000 threshold leaves space below the free-tier 100,000 daily write limit. When a reservation crosses the threshold, raw `events` rows are skipped but rollups continue. This means filtered dashboards can lose detail after the protection activates, while unfiltered rollup dashboards continue to work.

KV increments are best-effort counters, not a globally atomic distributed limiter. If traffic becomes large enough for strict enforcement, replace this with a stronger Cloudflare coordination primitive.

## Agent detection

`packages/shared/src/agents.ts` owns the classification logic and `agents/list.json` contains declared user-agent tokens. Verified Web Bot Auth takes precedence. The fallback order is:

1. verified signature, category agent, confidence 1.0
2. declared token, vendor and harness, confidence 0.9
3. browser automation signals, confidence 0.6
4. human, confidence 1.0

`packages/shared/src/web-bot-auth.ts` parses HTTP Message Signatures, fetches and caches the vendor key directory for 24 hours, and verifies Ed25519 signatures. It never treats a failed signature as verified.

Agent fields are stored on events and rolled into `daily_agents`. The agents dashboard reads these rollups through owner-scoped queries.

## Database and rollups

Migrations apply in this order:

```text
0001_auth.sql       users, refresh_tokens, reset_tokens
0002_projects.sql   projects and allowed_domains
0003_events.sql     denormalised event rows and indexes
0004_rollups.sql    daily analytics and agent dimensions
0005_audits.sql     PSI and agentic audit history
0006_vitals.sql     daily visitor Web Vital aggregates
```

`events` contains visitor/session IDs, event type and timestamps, page properties, user-agent enrichment, Cloudflare location, agent classification, and event source. It is retained for 90 days.

The main rollup tables are `daily_stats`, `daily_pages`, `daily_referrers`, `daily_countries`, `daily_regions`, `daily_cities`, `daily_browsers`, `daily_os`, `daily_devices`, `daily_agents`, `daily_visitors`, `daily_sessions`, and `daily_vitals`.

Page-view rollups use `INSERT ... ON CONFLICT DO UPDATE`. Visitor and session dimension rows use `INSERT OR IGNORE`, followed by `changes()` updates to daily counts. The rollup names for the original analytics tables live in `packages/shared/src/rollups.ts`; vitals use their own fixed schema because they store numeric totals.

The dashboard uses rollups when there are no filters. When a page, referrer, country, browser, OS, or device filter exists, it queries raw events so the filter is exact. Lists are capped at 50 rows.

## Audits and Web Vitals

The audit feature stores one row per run in `audits`. PSI provides mobile Lighthouse performance, accessibility, best-practices, SEO, and CrUX values. The agentic audit fetches robots.txt, llms.txt, sitemap.xml, the homepage, and the Web Bot Auth directory, then scores eight checks from 0 to 100. Raw PSI and checklist JSON remain in `raw_json`.

`GET /audits/:projectId?limit=30` returns newest audits plus a 30-day field-vital aggregate. `POST /audits/:projectId/run` is owner-scoped and rate-limited for ten minutes. `/dashboard/audits` renders gauges, history, field visitor means, CrUX values, PSI lab values, and checklist notes. `/demo/audits` uses deterministic seed data and makes mutations unavailable.

The current visitor field data shows the mean, because DEV-33 stores `count` and `total`. The `p75_sample` column exists for a future bounded sample implementation but currently receives the latest value. Do not present this mean as a p75.

## Web application architecture

`apps/web` uses Next.js 16 static export, React 19, Tailwind 4, shadcn-style primitives, Recharts, `next-themes`, and Sonner. Pages hosting serves the `out` directory.

Route groups:

- `(auth)`: guest-only login, signup, forgot-password, and reset pages
- `(app)`: authenticated dashboard, agents, audits, and settings pages
- `demo`: public deterministic dashboard, agents, and audits pages
- root `/`: public landing page

`AuthGuard` performs the client-side authenticated check for app routes. `GuestGuard` prevents an authenticated user from remaining on guest routes. `components/ui` contains the shared button, card, input, tabs, chart, dialog, skeleton, and toaster primitives.

State is local to feature clients. `dashboard-client` keeps query controls in the URL and fetches whenever the selected project or query changes. `agents-client` and `audits-client` follow the same project-loading pattern. `demo-context` switches API calls to seeded local data and shows a not-available toast for mutations.

The landing scene is `components/landing/scene.tsx`. It is a self-contained Canvas 2D implementation based on the supplied Gateway Flow source. `scene-loader.tsx` imports it through `next/dynamic` with SSR disabled. It has a gateway-flow hero variant, a constellation background variant, resize handling, theme-aware colors, cleanup on unmount, and reduced-motion handling.

The theme provider defaults to dark and uses `attribute="class"`. `ThemeToggle` switches between explicit dark and light themes. Do not change it back to system default without also deciding how the canvas scenes and screenshots should behave.

## Deployment and environments

`apps/api/wrangler.jsonc` contains local bindings plus `staging` and `prod` environments. Each environment has its own D1 database, KV namespace, Worker name, `WEB_URL`, and cron triggers.

Pages projects:

- `statify-staging`, deployed from `staging` to `https://statify-staging.pages.dev`
- `statify-app`, deployed from `main` to `https://statify-app.pages.dev`

`.github/workflows/staging.yml` and `prod.yml` install Bun 1.4.0, run typecheck, apply remote D1 migrations, deploy the API Worker, build the web export, and deploy Pages. API secrets are configured in the matching Cloudflare Worker environment. GitHub Actions needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; web builds need `API_URL` and `NEXT_PUBLIC_WEB_URL` environment variables.

Local values:

```text
apps/api/.dev.vars
  ACCESS_TOKEN_SECRET
  REFRESH_TOKEN_SECRET
  RESEND_API_KEY
  PSI_API_KEY
  WEB_URL=http://localhost:3000

apps/web/.env.local
  API_URL=<staging API URL>
  NEXT_PUBLIC_WEB_URL=http://localhost:3000
```

The files are ignored. Only `.example` files are tracked.

## Safe change checklist

Before editing:

1. Check the relevant Linear ticket and current branch status.
2. Inspect the shared schema and migration before changing event fields.
3. Confirm whether the feature affects browser SDK, server SDK, API, D1, KV, Pages, or deployment config.

After editing:

1. Run `bun run typecheck`.
2. Run `bun run lint` and `bun run build`.
3. Run `bun run db:fresh` when migrations or rollups changed.
4. Run `git diff --check`.
5. Scan tracked files and history for accidental secrets.
6. Use a focused commit message and push the intended branch.

Security checks that must remain true:

- every dashboard, audit, agent, and project query filters by owner ID
- access cookie lifetime equals access JWT lifetime
- refresh rotation deletes the previous hash
- browser API keys are treated as public and cannot be used as secrets
- auth and ingest limits stay in KV
- raw event retention stays at 90 days
- PSI, Resend, JWT, and Cloudflare credentials never enter source control

## Current handoff status

DEV-5 through DEV-34 are implemented in Linear. The latest work added visitor Web Vitals, launch rate limits, the D1 budget guard, weekly retention, the architecture README, and this context document. Before calling the product fully launched, verify production secrets, run a real production signup and dashboard check, install the production snippet on the production landing page, and confirm the first Web Vital rows appear in the audits view.
