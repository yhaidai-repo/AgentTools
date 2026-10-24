import { MAX_PBI_SKILLS, isRecommendableSkill } from "@powerloom/core";
import type { PbiSkill } from "@powerloom/db";
import { loadSkillCatalog } from "@/lib/skills";
import { PbiSkillsForm } from "./PbiSkillsForm";

// Skills every later agent on this PBI loads on top of its configured ones, as an editable checklist. Refinement
// recommends them; once the user saves, later refinements leave the list. Not in the Vault notes (user decision 2026-10-01).
export async function PbiSkills({ adoId, skills, editedAt }: { adoId: number; skills: PbiSkill[]; editedAt: Date | null }) {
  const catalog = (await loadSkillCatalog()).skills.filter((skill) => isRecommendableSkill(skill.name));
  const origin = editedAt ? "Your list: later refinements keep it." : skills.length > 0 ? "Refinement's recommendation; saving makes it yours." : "None chosen yet.";

  return (
    <>
      <p className="muted">{origin} At most {MAX_PBI_SKILLS}.</p>
      {/* Keyed by the saved list, so the form starts over from what was saved. */}
      <PbiSkillsForm key={JSON.stringify(skills)} adoId={adoId} skills={skills} catalog={catalog} />
    </>
  );
}
