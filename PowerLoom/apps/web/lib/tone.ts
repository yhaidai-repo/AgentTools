import type { BudgetLevel } from "./budget";
import type { StateLevel } from "./systemStatus";
import type { Tone } from "@/models/Tone";

const STATE_TONES: Record<StateLevel, Tone> = { ok: "good", degraded: "warn", failed: "error" };

const BUDGET_TONES: Record<BudgetLevel, Tone> = { good: "plain", warning: "warn", critical: "error" };

// The CSS class of a tone; plain has none.
export function toneClass(tone: Tone): string {
  return tone === "plain" ? "" : ` tone-${tone}`;
}

export function toneOfState(state: StateLevel | undefined): Tone {
  return state ? STATE_TONES[state] : "plain";
}

export function toneOfBudget(level: BudgetLevel | null): Tone {
  return level ? BUDGET_TONES[level] : "plain";
}

// The worst of several tones: one failing part makes the whole read as failing.
export function worstTone(tones: Tone[]): Tone {
  const order: Tone[] = ["plain", "good", "warn", "error"];

  return tones.reduce((worst, tone) => (order.indexOf(tone) > order.indexOf(worst) ? tone : worst), "plain");
}
