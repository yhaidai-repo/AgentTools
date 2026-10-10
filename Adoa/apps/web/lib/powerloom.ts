import createClient from "openapi-fetch";
import type { paths } from "@/lib/powerloom/schema";
import type { ActionResult } from "@/models/ActionResult";

// PowerLoom, the .NET backend taking over the worker's jobs feature by feature (the vault's adoa-backend-delivery note).
// The client is typed from PowerLoom/openapi/PowerLoom.Api.json (`npm run openapi` after an API change).
export const powerloom = createClient<paths>({ baseUrl: process.env.POWERLOOM_URL?.replace(/\/+$/, "") ?? "http://powerloom-url-not-set" });

type ProblemDetails = { title?: string; detail?: string };

// An expected failure comes back as ProblemDetails: its detail is the page's message.
export function powerloomResult(response: { error?: unknown; response: Response }, done: string): ActionResult {
  if (response.response.ok) {
    return { ok: true, message: done };
  }

  const problem = (response.error ?? {}) as ProblemDetails;

  return { ok: false, message: problem.detail ?? problem.title ?? `PowerLoom answered ${response.response.status}.` };
}
