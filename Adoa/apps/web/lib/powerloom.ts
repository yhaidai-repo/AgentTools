import type { ActionResult } from "@/models/ActionResult";

// PowerLoom, the .NET backend taking over the worker's jobs feature by feature (the vault's adoa-backend-delivery note).
type ProblemDetails = { title?: string; detail?: string };

// A change through PowerLoom: an expected failure comes back as ProblemDetails, whose detail is the page's message.
export async function callPowerLoom(method: "POST" | "DELETE", path: string, body: object, done: string): Promise<ActionResult> {
  const baseUrl = process.env.POWERLOOM_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    return { ok: false, message: "POWERLOOM_URL isn't set." };
  }

  const response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  if (response.ok) {
    return { ok: true, message: done };
  }

  const problem = (await response.json().catch(() => ({}))) as ProblemDetails;

  return { ok: false, message: problem.detail ?? problem.title ?? `PowerLoom answered ${response.status}.` };
}
