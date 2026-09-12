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
