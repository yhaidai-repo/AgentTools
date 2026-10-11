import type { ChatTarget } from "@powerloom/core";
import { ContinueButton } from "@/components/ContinueButton";
import { powerloom } from "@/lib/powerloom";

// The button with its label and, when no chat can open, the reason; checking changes nothing (one answer for every
// button: the chat has no per-target checks).
export async function ContinueChat({ target, verb = "Continue" }: { target: ChatTarget; verb?: string }) {
  const { data } = await powerloom.GET("/api/chats/launcher");

  return <ContinueButton target={target} label={data?.label ?? "agent"} problem={data ? data.problem ?? null : "PowerLoom isn't reachable."} verb={verb} />;
}
