export type Step = "next" | "stop";

// Runs one batch item; an unexpected error is logged and collected (never swallowed) and the batch moves on.
export async function safeStep(agentId: string, itemLabel: string, errors: string[], step: () => Promise<Step>): Promise<Step> {
  try {
    return await step();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`${agentId} ${itemLabel}: unexpected error`, error);
    errors.push(`${itemLabel}: ${message}`);

    return "next";
  }
}

// A batch with item errors fails its job, so pg-boss keeps the error and the Agents page shows it.
export function throwIfErrors(agentId: string, errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`${agentId} batch: ${errors.length} error(s): ${errors.join(" | ")}`);
  }
}
