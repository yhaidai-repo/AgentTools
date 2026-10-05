import type { ChatLauncher } from "../models/ChatLauncher";
import { claudeDesktopLauncher } from "./launchers/claudeDesktopLauncher";

// Every agent app a chat can be continued in; CONTINUE_LAUNCHER picks one (default claude-desktop).
const LAUNCHERS: ChatLauncher[] = [claudeDesktopLauncher];

export const DEFAULT_CHAT_LAUNCHER = claudeDesktopLauncher.id;

export function chatLauncher(id: string): ChatLauncher | null {
  return LAUNCHERS.find((launcher) => launcher.id === id) ?? null;
}

export function chatLauncherIds(): string[] {
  return LAUNCHERS.map((launcher) => launcher.id);
}
