// The skills agents may load (the skill folders the caller can see).
export interface SkillCatalog {
  names(): Promise<string[]>;
}
