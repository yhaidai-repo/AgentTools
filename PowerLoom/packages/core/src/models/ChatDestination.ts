// Existing desktop conversation selected for one launch; Settings' default app is unchanged.
export interface ChatDestination {
  launcher: "claude-desktop" | "codex-desktop";
  conversationId: string;
}
