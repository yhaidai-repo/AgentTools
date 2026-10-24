import type { Outcome } from "../models/Outcome";

// A port's outcome as a command's: a failure passes through, a value is shaped for the caller.
export function mapOutcome<T, U>(outcome: Outcome<T>, map: (value: T) => U): Outcome<U> {
  return outcome.ok ? { ok: true, value: map(outcome.value) } : outcome;
}
