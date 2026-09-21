"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard, Code2 } from "lucide-react";
import { codeToHtml } from "shiki";
import { installSnippets, type InstallSnippet } from "@statify/shared/snippets";
import { Button } from "@/components/ui/button";

export function SnippetPicker() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<Record<string, string>>({});
  const selected: InstallSnippet =
    installSnippets[selectedIndex] ?? installSnippets[0]!;

  useEffect(() => {
    let active = true;
    void Promise.all(
      installSnippets.map(
        async (snippet) =>
          [
            snippet.label,
            await codeToHtml(snippet.code, {
              lang: snippet.language,
              theme: "vitesse-dark",
            }),
          ] as const,
      ),
    ).then((entries) => {
      if (active) setHighlighted(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(selected.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-[#0a0a0a] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <div className="flex items-center gap-2 text-sm">
          <Code2 className="size-4" /> Install Statify
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Clipboard />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 pt-2">
        {installSnippets.map((snippet, index) => (
          <button
            key={snippet.label}
            type="button"
            onClick={() => {
              setSelectedIndex(index);
              setCopied(false);
            }}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors ${selectedIndex === index ? "border-white text-white" : "border-transparent text-white/55 hover:text-white"}`}
          >
            {snippet.label}
          </button>
        ))}
      </div>
      <div
        className="h-80 overflow-x-auto p-6 text-xs leading-6 text-white/90 [&_pre]:!m-0 [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{
          __html:
            highlighted[selected.label] ??
            `<pre><code>${selected.code}</code></pre>`,
        }}
      />
    </div>
  );
}
