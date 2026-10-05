// The skills a person picks for a PBI's later agents, each with why.
export interface PbiSkillChoices {
  adoId: number;
  skills: { name: string; reason: string }[];
}
