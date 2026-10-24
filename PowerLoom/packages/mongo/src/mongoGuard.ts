// What a read-only user could still do harm with: stages that write ($out, $merge) and operators that run code on the
// server ($where, $function, $accumulator). The connection string's user is read-only too; this keeps the refusal
// an answer instead of a server error.
const FORBIDDEN = new Set(["$out", "$merge", "$where", "$function", "$accumulator"]);

// Why a pipeline may not run, or null.
export function pipelineProblem(pipeline: unknown[]): string | null {
  if (pipeline.length === 0) {
    return 'The pipeline is empty: give at least one stage, e.g. [{ "$match": { "status": "open" } }, { "$limit": 20 }].';
  }

  return problemOf(forbiddenOperators(pipeline), "a pipeline");
}

// Why a filter (or a projection, a sort) may not run, or null.
export function filterProblem(filter: unknown): string | null {
  return problemOf(forbiddenOperators(filter), "a filter");
}

function problemOf(operators: string[], where: string): string | null {
  return operators.length === 0 ? null : `Read only: ${operators.join(", ")} can't be used in ${where}.`;
}

// Every forbidden key anywhere in the value, once each.
function forbiddenOperators(value: unknown): string[] {
  return [...new Set(keysOf(value).filter((key) => FORBIDDEN.has(key)))];
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [key, ...keysOf(nested)]);
}
