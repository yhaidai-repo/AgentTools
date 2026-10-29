import type { AgentDefinition } from "./models/AgentDefinition";
import type { ShippedFields } from "./models/ShippedFields";

type ShippedField = Exclude<keyof ShippedFields, "note">;

// The fields of a system agent that come from the code; the user's settings (switch, schedule, model, limits, budgets,
// options, integrations) are not among them.
export const CODE_OWNED_FIELDS = ["label", "description", "prompt", "skills", "canAssign", "handles", "waitFor"] as const;

const PLAIN_FIELDS = ["label", "description", "canAssign", "handles", "waitFor"] as const;

// The code-owned fields as this code ships them; the prompt as its file's hash.
export function shippedFieldsOf(defaults: AgentDefinition, promptHash: string): ShippedFields {
  return {
    label: defaults.label,
    description: defaults.description,
    prompt: promptHash,
    skills: defaults.skills,
    canAssign: defaults.canAssign,
    handles: defaults.handles,
    waitFor: defaults.waitFor,
  };
}

// System agents run on what the code ships (release decision 2026-10-29): a code-owned field takes the shipped value
// whenever the code changed it since it was last applied, so an upgrade brings the new prompt, skills and pipeline; an
// edit made after that stays until the code changes the field again. A copy stored before this record existed takes
// every shipped value once. An edited prompt stays in the prompt history (agent_prompt_version) to restore.
export function codeOwnedFields(stored: Partial<AgentDefinition>, defaults: AgentDefinition, shippedSkillNames: ReadonlySet<string>): Partial<AgentDefinition> {
  const shipped = defaults.shipped ?? shippedFieldsOf(defaults, "");
  const isUnchanged = (field: ShippedField) => stored.shipped !== undefined && isSame(stored.shipped[field], shipped[field]);
  const plain = PLAIN_FIELDS.map((field) => [field, isUnchanged(field) && stored[field] !== undefined ? stored[field] : defaults[field]]);

  return {
    ...Object.fromEntries(plain),
    ...promptFields(stored, isUnchanged("prompt")),
    skills: isUnchanged("skills") && stored.skills ? stored.skills : skillsWithAdditions(stored, shipped, shippedSkillNames),
  };
}

// The code-owned fields whose stored value the merged one replaced.
export function replacedFields(stored: Partial<AgentDefinition>, merged: AgentDefinition): string[] {
  return CODE_OWNED_FIELDS.filter((field) => stored[field] !== undefined && !isSame(stored[field], merged[field]));
}

// Empty = the prompt file applies.
function promptFields(stored: Partial<AgentDefinition>, isUnchanged: boolean): Pick<AgentDefinition, "prompt" | "promptVersion"> {
  if (!isUnchanged) {
    return { prompt: "", promptVersion: 0 };
  }

  return { prompt: stored.prompt ?? "", promptVersion: stored.promptVersion ?? 0 };
}

// The shipped skills, then the ones the user added (any skill the code didn't ship to this agent last time; without a
// record, any skill no system agent ships), so a project's own skill stays with the agent it was added to.
function skillsWithAdditions(stored: Partial<AgentDefinition>, shipped: ShippedFields, shippedSkillNames: ReadonlySet<string>): string[] {
  const previous = new Set(stored.shipped?.skills ?? [...shippedSkillNames, ...shipped.skills]);
  const additions = (stored.skills ?? []).filter((skill) => !previous.has(skill));

  return [...new Set([...shipped.skills, ...additions])];
}

// Lists are sets here (skills, task types, checks): another order is the same value.
function isSame(left: unknown, right: unknown): boolean {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

function comparable(value: unknown): unknown {
  return Array.isArray(value) ? [...value].sort() : value;
}
