import type { ChatTarget } from "@powerloom/core";
import { ContinueButton } from "@/components/ContinueButton";
import { chatLauncher } from "@/lib/chatLauncher";

// The button with its label and, when no chat can open, the reason.
export async function ContinueChat({ target, verb = "Continue" }: { target: ChatTarget; verb?: string }) {
  const launcher = await chatLauncher();

  return <ContinueButton target={target} label={launcher.label} problem={launcher.problem} verb={verb} />;
}
