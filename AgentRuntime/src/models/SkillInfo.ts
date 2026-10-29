export interface SkillInfo {
  name: string;
  description: string;
  /** Full SKILL.md text, returned by use_skill. */
  body: string;
  /** Preloaded, explicitly linked Markdown within this skill; never arbitrary paths. */
  supportingFiles?: Readonly<Record<string, string>>;
  unavailableSupportingFiles?: string[];
}
