import { powerloom } from "@/lib/powerloom";
import type { ChatLauncherState } from "@/models/ChatLauncherState";

// One answer for every chat button: checking changes nothing and the chat has no per-target checks.
export async function chatLauncher(): Promise<ChatLauncherState> {
  const { data } = await powerloom.GET("/api/chats/launcher");

  return { label: data?.label ?? "agent", problem: data ? data.problem ?? null : "PowerLoom isn't reachable." };
}
