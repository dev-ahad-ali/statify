import agentList from "./agents/list.json" with { type: "json" };

export type AgentCategory = "human" | "crawler" | "agent" | "automation";

export type AgentClassification = {
  category: AgentCategory;
  vendor?: string;
  harness?: string;
  model?: string;
  confidence: number;
  signatureFailed?: boolean;
};

export type AgentInput = {
  userAgent: string;
  headers: Record<string, string | undefined>;
  automation?: { webdriver?: boolean; headless?: boolean; noPointer?: boolean };
  verified?: { vendor: string; model?: string };
  signatureFailed?: boolean;
};

const automationTokens = [
  ["HeadlessChrome", "Headless Chrome"],
  ["Playwright", "Playwright"],
  ["Puppeteer", "Puppeteer"],
  ["browser-use", "browser-use"],
] as const;

export function classify(input: AgentInput): AgentClassification {
  const explicitModel =
    input.headers["x-agent-model"] ?? input.headers["X-Agent-Model"];
  if (input.verified)
    return {
      category: "agent",
      vendor: input.verified.vendor,
      harness: "Web Bot Auth",
      model: input.verified.model ?? explicitModel,
      confidence: 1,
      signatureFailed: input.signatureFailed,
    };

  const userAgent = input.userAgent || "";
  const matched = Object.entries(agentList).find(([token]) =>
    userAgent.toLowerCase().includes(token.toLowerCase()),
  );
  if (matched) {
    const [, record] = matched;
    const agent = record as {
      vendor: string;
      category: AgentCategory;
      harness?: string;
    };
    return {
      category: agent.category,
      vendor: agent.vendor,
      harness: agent.harness,
      model: explicitModel,
      confidence: 0.9,
      signatureFailed: input.signatureFailed,
    };
  }

  const automationToken = automationTokens.find(([token]) =>
    userAgent.toLowerCase().includes(token.toLowerCase()),
  );
  const automationSignal =
    input.automation?.webdriver ||
    input.automation?.headless ||
    input.automation?.noPointer;
  if (automationToken || automationSignal)
    return {
      category: "automation",
      harness: automationToken?.[1] ?? "browser automation",
      model: explicitModel,
      confidence: 0.6,
      signatureFailed: input.signatureFailed,
    };
  return {
    category: "human",
    model: explicitModel,
    confidence: 1,
    signatureFailed: input.signatureFailed,
  };
}

export { agentList };
