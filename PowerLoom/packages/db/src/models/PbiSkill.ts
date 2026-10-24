// A skill later agents on a PBI load on top of their configured ones (refinement recommends, the user edits).
export interface PbiSkill {
  name: string;
  reason: string;
  by: "agent" | "user";
}
