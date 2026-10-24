import { createPowerLoomClient, problemDetail } from "@powerloom/client";
import type { ActionResult } from "@/models/ActionResult";

// PowerLoom, the .NET backend (the vault's adoa-backend-delivery note): the web's client, from @powerloom/client.
export const powerloom = createPowerLoomClient(process.env.POWERLOOM_URL);

// An expected failure comes back as ProblemDetails: its detail is the page's message.
export function powerloomResult(response: { error?: unknown; response: Response }, done: string): ActionResult {
  if (response.response.ok) {
    return { ok: true, message: done };
  }

  return { ok: false, message: problemDetail(response.error, response.response) };
}
