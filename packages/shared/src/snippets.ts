export type InstallSnippet = {
  label: string;
  language: "html" | "tsx" | "svelte" | "typescript" | "javascript";
  code: string;
};

const SCRIPT_URL = "https://statify-app.pages.dev/statify.js";
const API_KEY = "YOUR_API_KEY";

export const installSnippets: readonly InstallSnippet[] = [
  {
    label: "HTML",
    language: "html",
    code: `<script defer src="${SCRIPT_URL}" data-api-key="${API_KEY}"></script>`,
  },
  {
    label: "Next.js",
    language: "tsx",
    code: `import Script from "next/script";

<Script
  src="${SCRIPT_URL}"
  data-api-key="${API_KEY}"
  strategy="afterInteractive"
/>`,
  },
  {
    label: "React",
    language: "tsx",
    code: `export function StatifyScript() {
  return (
    <script
      defer
      src="${SCRIPT_URL}"
      data-api-key="${API_KEY}"
    />
  );
}`,
  },
  {
    label: "SvelteKit",
    language: "svelte",
    code: `<svelte:head>
  <script
    defer
    src="${SCRIPT_URL}"
    data-api-key="${API_KEY}"
  ></script>
</svelte:head>`,
  },
  {
    label: "Nuxt",
    language: "typescript",
    code: `export default defineNuxtConfig({
  app: {
    head: {
      script: [{
        src: "${SCRIPT_URL}",
        defer: true,
        "data-api-key": "${API_KEY}",
      }],
    },
  },
});`,
  },
  {
    label: "Astro",
    language: "typescript",
    code: `---
const apiKey = "${API_KEY}";
---

<script
  is:inline
  defer
  src="${SCRIPT_URL}"
  data-api-key={apiKey}
></script>`,
  },
  {
    label: "Express middleware",
    language: "typescript",
    code: `import { statify } from "@statify/sdk/server/express";

app.use(statify({
  apiKey: process.env.STATIFY_API_KEY!,
}));`,
  },
  {
    label: "Next middleware",
    language: "typescript",
    code: `import { statifyNext } from "@statify/sdk/server/next";

export const middleware = statifyNext({
  apiKey: process.env.STATIFY_API_KEY!,
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};`,
  },
];
