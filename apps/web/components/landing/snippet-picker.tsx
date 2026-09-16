"use client";

import { useState } from "react";
import { Check, Clipboard, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const snippets = {
  HTML: '<script src="https://statify.pages.dev/statify.js" data-api-key="YOUR_API_KEY" defer></script>',
  "Next.js": "import { Statify } from \"@statify/sdk/next\";\n\nexport default function Middleware() {\n  return Statify({ apiKey: \"YOUR_API_KEY\" });\n}",
  Express: "import { statify } from \"@statify/sdk/express\";\n\napp.use(statify({ apiKey: \"YOUR_API_KEY\" }));",
  React: '<script src="https://statify.pages.dev/statify.js" data-api-key="YOUR_API_KEY" defer></script>',
};

export function SnippetPicker() {
  const [selected, setSelected] = useState<keyof typeof snippets>("HTML");
  const [copied, setCopied] = useState(false);
  const code = snippets[selected];
  async function copy() { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-2xl shadow-black/20 backdrop-blur"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div className="flex items-center gap-2 text-sm"><Code2 className="size-4 text-primary" /> Install Statify</div><Button variant="ghost" size="sm" onClick={() => void copy()}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy"}</Button></div><div className="flex gap-1 overflow-x-auto border-b border-border/70 px-3 pt-2">{(Object.keys(snippets) as Array<keyof typeof snippets>).map((name) => <button key={name} type="button" onClick={() => setSelected(name)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors ${selected === name ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{name}</button>)}</div><pre className="min-h-48 overflow-x-auto p-6 text-xs leading-6 text-primary/90"><code>{code}</code></pre></div>;
}
