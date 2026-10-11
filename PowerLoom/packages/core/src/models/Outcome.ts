// Expected failures (invalid input, not found, conflicts) come back as values, not exceptions.
export type Outcome<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };
