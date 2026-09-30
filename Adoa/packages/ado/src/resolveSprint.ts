import type { AdoClient } from "./AdoClient";
import type { AdoIteration } from "./models/AdoIteration";

export const CURRENT_SPRINT = "current";

// "current" follows ADO's own current iteration, so the sync moves on when the sprint ends.
export async function resolveSprint(client: AdoClient, selection: string): Promise<AdoIteration | null> {
  if (selection === CURRENT_SPRINT) {
    const [current] = await client.getIterations(true);

    return current ?? null;
  }

  const iterations = await client.getIterations(false);

  return iterations.find((iteration) => iteration.path === selection) ?? null;
}
