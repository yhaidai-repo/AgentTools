import type { ItemChat } from "../models/ItemChat";

// Questions, human tasks and findings get a chat (user decision 2026-10-05); nothing changes in adoa until the user pastes
// the chat's answer or result there (later the adoa MCP writes it back).
export const ITEM_CHATS: Record<string, ItemChat> = {
  question: {
    opening: "Help me answer question",
    briefing: [
      "**The question**: in short, and what it blocks.",
      "**What we know**: from the notes and the code, with `file:line`.",
      "**Options**: each with pros and cons.",
      "**Suggested answer**.",
    ],
    ending: "End by asking \"Use this answer?\" Change no file. After a yes, give the final answer as plain text to paste into adoa's answer form.",
  },
  human: {
    opening: "Help me with human task",
    briefing: [
      "**The task**: in short.",
      "**Why**: what it blocks.",
      "**Steps**: mark the ones only I can do (access, people).",
      "**What to report back**.",
    ],
    ending: "End by asking \"Shall I help with step 1?\" Change no file unless I ask. When the task is done, give the result as plain text to paste into adoa.",
  },
  finding: {
    opening: "Help me review finding",
    briefing: [
      "**The finding**: in short, and the register it would go to (open questions or known issues).",
      "**Is it true?**: checked against the code and notes, with `file:line`.",
      "**Already recorded?**: a matching record in the project's registers, if any.",
      "**Recommendation**: submit as is, edit (with the edited title and text), or dismiss, and why.",
    ],
    ending: "End by asking \"Submit, edit or dismiss?\" Change no file. After the answer, give the final title and text to paste into adoa's finding form.",
  },
};

export function hasItemChat(kind: string): boolean {
  return ITEM_CHATS[kind] !== undefined;
}
