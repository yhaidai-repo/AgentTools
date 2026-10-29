// What an older version stored for the Demonstration agent, which was called "support guide" until 2026-10-30.
export const LEGACY_AGENT_ID = "support-guide";
export const AGENT_ID = "demonstration";

// Whole values and object keys of a stored agent definition, schedule or offer record.
export const IDENTIFIER_RENAMES: ReadonlyMap<string, string> = new Map([
  [LEGACY_AGENT_ID, AGENT_ID],
  ["support-guide-result", "demonstration-result"],
  ["powerloom-support-guide", "powerloom-demonstration"],
  ["writeSupportGuides", "writeDemonstrations"],
  ["write_support_guide", "write_demonstration"],
]);

// Names a prompt edited in Settings may still request; its text is rewritten, not replaced.
export const PROMPT_RENAMES: ReadonlyArray<readonly [string, string]> = [
  ["powerloom-support-guide", "powerloom-demonstration"],
  ["support-guide-input", "demonstration-input"],
  ["write_support_guide", "write_demonstration"],
];

// The tool's old description in the Tools tab, kept until the agent's next run offers the new one.
export const LEGACY_TOOL_SUMMARY = "Save a structured support guide checkpoint.";
export const TOOL_SUMMARY = "Save a structured demonstration guide checkpoint.";
