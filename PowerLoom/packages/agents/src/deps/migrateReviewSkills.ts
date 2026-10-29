import type { PostgresAgentConfigStore } from "@agenttools/config";

const LEGACY_SKILL = "powerloom-better-review";
const REVIEW_SKILL = "powerloom-code-review";

// Saved skills override shipped defaults. Upgrade Better Review without replacing the user's other configuration.
export async function migrateReviewSkills(store: Pick<PostgresAgentConfigStore, "get" | "saveIfUnchanged">): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store.get("better-review");
    if (!current?.skills.includes(LEGACY_SKILL)) return;
    // Keep a name a custom prompt still requests, and grant the canonical skill its redirect needs.
    const skills = current.prompt?.includes(LEGACY_SKILL)
      ? [...new Set([...current.skills, REVIEW_SKILL])]
      : [...new Set(current.skills.map(skill => skill === LEGACY_SKILL ? REVIEW_SKILL : skill))];
    if (JSON.stringify(skills) === JSON.stringify(current.skills)) return;
    if (await store.saveIfUnchanged(current, { ...current, skills })) return;
  }

  console.warn("Better Review's skill upgrade was deferred after concurrent configuration edits; the compatibility skill remains available.");
}
