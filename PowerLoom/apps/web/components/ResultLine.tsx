import type { ActionResult } from "@/models/ActionResult";

// An action's answer beside its buttons: teal when it worked, rose when it didn't.
export function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) {
    return null;
  }

  return <span className={result.ok ? "result-ok" : "result-error"}>{result.message}</span>;
}
