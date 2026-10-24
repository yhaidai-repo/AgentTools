import { CodexSdkRuntime } from "./CodexSdkRuntime";

const codexHome = process.env.POWERLOOM_CODEX_HOME;

if (!codexHome) {
  throw new Error("Set POWERLOOM_CODEX_HOME to a dedicated authenticated runtime folder.");
}

const runtime = new CodexSdkRuntime({ codexHome, keepConversations: true });
const run = runtime.run({
  runId: "codex-smoke",
  model: { provider: "openai-codex", model: process.env.POWERLOOM_CODEX_MODEL ?? "gpt-6.1-sol", effort: "low" },
  systemPrompt: "Call verify_tool exactly once, then reply with the word returned by it. Use no other tool.",
  firstMessage: "Verify the PowerLoom MCP tool connection.",
  tools: [{ name: "verify_tool", description: "Return the verification word.", input: {}, annotations: { readOnly: true }, handler: async () => ({ text: "powerloom-connected" }) }],
  limits: { maxTurns: 3, timeoutMs: 60_000 },
  conversation: { id: "powerloom-smoke", continues: null },
});

for await (const event of run) {
  console.log(JSON.stringify(event));
}
