# Statify

Statify is a privacy-first analytics product built as a Bun and Turborepo monorepo.

## Workspaces

- `apps/api`: Cloudflare API Worker
- `apps/web`: Next.js dashboard and landing page
- `packages/sdk`: browser and server-side tracking SDKs
- `packages/shared`: Zod schemas and TypeScript contracts shared by the API and web app

The repository also contains shared ESLint and TypeScript configuration packages.

## Commands

```sh
bun install
bun run dev
bun run dev:api
bun run dev:web
bun run typecheck
bun run build

# Reset the local D1 database and load its demo user/project
bun run db:fresh
```

The API accepts browser batches at `POST /ingest`. Each valid page-view batch writes raw events and daily rollups in one D1 batch. A 50-event request can create roughly 12 D1 rows per page view, so the free D1 write limit is the first traffic limit to watch.

The browser SDK is built with `bun run build --filter=@statify/sdk` and writes `packages/sdk/dist/statify.global.js`. Add it to a site with `data-api-key`. It ignores `navigator.doNotTrack`; Statify stores analytics events without IP addresses or cookies, and the product documentation should state that choice.

## Deployment

The API runs on Cloudflare Workers. The web app is a static Next.js export deployed to Cloudflare Pages, with a Pages Function forwarding `/api/*` to the API Worker.

- Production: `statify-app.pages.dev`
- Staging: `statify-staging.pages.dev`

The staging workflow uses `wrangler.staging.jsonc`. The production workflow uses `wrangler.jsonc`. Both workflows run typechecking first, then deploy the API and Pages site.
