import { test, expect, describe } from "bun:test";
import { classify } from "../src/agents.ts";

const cases: Array<[string, "human" | "crawler" | "agent"]> = [
  [
    "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "crawler",
  ],
  ["ChatGPT-User/1.0", "agent"],
  ["OAI-SearchBot/1.0", "crawler"],
  ["ClaudeBot/0.1", "crawler"],
  ["Claude-User/1.0", "agent"],
  ["Claude-SearchBot", "crawler"],
  ["anthropic-ai", "crawler"],
  ["PerplexityBot/1.0", "crawler"],
  ["Perplexity-User", "agent"],
  ["Google-Extended", "crawler"],
  ["Googlebot/2.1", "crawler"],
  ["Bytespider", "crawler"],
  ["CCBot/2.0", "crawler"],
  ["Amazonbot/0.1", "crawler"],
  ["Applebot-Extended/1.0", "crawler"],
  ["meta-externalagent", "crawler"],
  ["cohere-ai", "crawler"],
  ["DuckAssistBot", "crawler"],
  ["YouBot", "crawler"],
  ["Bingbot/2.0", "crawler"],
  ["Mozilla/5.0 Chrome/120.0", "human"],
  ["Mozilla/5.0 Safari/17.0", "human"],
  ["curl/8.0", "human"],
  ["HeadlessChrome/120", "human"],
  ["Playwright/1.40", "human"],
  ["Puppeteer/22", "human"],
  ["browser-use/0.1", "human"],
  ["Google Chrome", "human"],
  ["Mozilla/5.0 Firefox", "human"],
  ["Safari", "human"],
];

describe("agent classifier", () => {
  test.each(cases)("classifies %s", (userAgent, category) => {
    const expected = [
      "HeadlessChrome/120",
      "Playwright/1.40",
      "Puppeteer/22",
      "browser-use/0.1",
    ].includes(userAgent)
      ? "automation"
      : category;
    expect(classify({ userAgent, headers: {} }).category).toBe(expected);
  });
  test("prioritizes a verified Web Bot Auth vendor", () => {
    expect(
      classify({
        userAgent: "Mozilla/5.0",
        headers: { "x-agent-model": "o4-mini" },
        verified: { vendor: "OpenAI" },
      }),
    ).toEqual({
      category: "agent",
      vendor: "OpenAI",
      harness: "Web Bot Auth",
      model: "o4-mini",
      confidence: 1,
      signatureFailed: undefined,
    });
  });
});
