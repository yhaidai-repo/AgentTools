import type { ContinueResult } from "../models/ContinueResult";

export const CLAUDE_COPIED_NOTICE = "Prompt copied. Paste it into the selected Claude chat.";

// Copying must finish, and its notification must be shown, before app navigation takes focus away.
export async function launchDesktopChat(result: ContinueResult, actions: { copy: (text: string) => Promise<void>; notify: (message: string) => void; navigate: (url: string) => void }) {
  if (!result.ok || !result.link) return { error: result.message, manual: null };

  if (result.clipboardText) {
    try {
      await actions.copy(result.clipboardText);
    } catch {
      return { error: "Couldn't copy the prompt. Copy it below or retry before opening the chat.", manual: result };
    }
    actions.notify(CLAUDE_COPIED_NOTICE);
  } else {
    actions.notify("Opening the chat…");
  }

  actions.navigate(result.link);
  return { error: null, manual: null };
}
