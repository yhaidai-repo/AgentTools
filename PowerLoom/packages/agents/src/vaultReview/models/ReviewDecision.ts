// What the vault-review agent decided about one note; applied when the run succeeds.
export interface ReviewDecision {
  vault: string;
  /** Relative to the vault root. */
  path: string;
  action: "keep" | "remove" | "actualize";
  reasons: string;
  /** Actualize only: the facts the tech-writer should check first. */
  suspectFacts: string[];
}
