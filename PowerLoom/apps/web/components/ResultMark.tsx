import type { ActionResult } from "@/models/ActionResult";

// An action's answer where a line doesn't fit (a table cell): a teal ✓ or a rose ✕, the message in its tooltip.
export function ResultMark({ result }: { result: ActionResult | null }) {
  if (!result) {
    return null;
  }

  return <span className={result.ok ? "result-ok" : "result-error"} title={result.message} aria-label={result.message}>{result.ok ? "✓" : "✕"}</span>;
}
