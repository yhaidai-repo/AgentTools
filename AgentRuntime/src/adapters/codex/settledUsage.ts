import type { CodexTokenTotals } from "./models/CodexTokenTotals";
import { objectOf } from "./codexWindows";

// A max-turn stop occurs at a completed item boundary, after the SDK process has exited. A durable
// response ledger followed by its matching cumulative token_count closes that accounting boundary.
// This is not evidence for a crash, timeout, user/budget abort, or a still-running process.
export class SettledUsage {
  private ledger: CodexTokenTotals | null = null;
  private counted: CodexTokenTotals | null = null;
  private valid = true;
  private lastWasCount = false;

  add(entry: Record<string, unknown>): void {
    const payload = objectOf(entry.payload);
    this.lastWasCount = false;
    if (!entry.type) { this.valid = false; return; }
    if (entry.type === "response_item" && !["function_call_output", "custom_tool_call_output"].includes(String(payload.type))) {
      this.ledger = null;
    }
    if (entry.type === "token_usage_record") {
      this.ledger = totals(payload.thread_token_usage);
      if (!this.ledger) this.valid = false;
    }
    if (entry.type === "event_msg" && payload.type === "token_count") {
      if (payload.info === null) return; // Subscription-only update, not a token measurement.
      const next = totals(objectOf(payload.info).total_token_usage);
      if (!next || (this.counted && (next.input < this.counted.input || next.cachedInput < this.counted.cachedInput || next.output < this.counted.output))) this.valid = false;
      this.counted = next;
      this.lastWasCount = true;
    }
  }

  result(): CodexTokenTotals | null {
    return this.valid && this.lastWasCount && this.ledger && this.counted && equalTotals(this.ledger, this.counted) ? this.counted : null;
  }
}

export function equalTotals(a: CodexTokenTotals, b: CodexTokenTotals): boolean {
  return a.input === b.input && a.output === b.output && a.cachedInput === b.cachedInput;
}

export function validTotals(t: CodexTokenTotals): boolean {
  return [t.input, t.cachedInput, t.output].every(v => Number.isSafeInteger(v) && v >= 0) && t.cachedInput <= t.input;
}

function totals(value: unknown): CodexTokenTotals | null {
  const t = objectOf(value);
  const values = [t.input_tokens, t.cached_input_tokens, t.output_tokens];
  if (!values.every(v => typeof v === "number" && Number.isSafeInteger(v) && v >= 0) || Number(t.cached_input_tokens) > Number(t.input_tokens)) return null;
  return { input: Number(t.input_tokens), cachedInput: Number(t.cached_input_tokens), output: Number(t.output_tokens) };
}
