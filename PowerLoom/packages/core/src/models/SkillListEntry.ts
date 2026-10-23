import type { SkillSummary } from "./SkillSummary";

// One skill as skill.list answers it: its summary and the agents whose definition lists it (PBIs may add it to others).
export interface SkillListEntry extends SkillSummary {
  usedBy: { id: string; label: string }[];
}
