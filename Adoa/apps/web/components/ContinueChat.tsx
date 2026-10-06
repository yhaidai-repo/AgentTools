import { chatAvailability, type ChatTarget } from "@adoa/core";
import { webCommandContext } from "@/lib/commandContext";
import { ContinueButton } from "./ContinueButton";

// The button with its label and, when the chat can't open yet, the reason; checking changes nothing.
export async function ContinueChat({ target, verb = "Continue" }: { target: ChatTarget; verb?: string }) {
  const { label, problem } = await chatAvailability(webCommandContext(), target);

  return <ContinueButton target={target} label={label} problem={problem} verb={verb} />;
}
