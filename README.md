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
```

The API and SDK currently contain compile-checked placeholders. Feature work will add their runtime implementations in later tickets.

## Deployment

The API runs on Cloudflare Workers. The web app is a static Next.js export deployed to Cloudflare Pages, with a Pages Function forwarding `/api/*` to the API Worker.

- Production: `statify-app.pages.dev`
- Staging: `statify-staging.pages.dev`

The staging workflow uses `wrangler.staging.jsonc`. The production workflow uses `wrangler.jsonc`. Both workflows run typechecking first, then deploy the API and Pages site.
