import { MAX_PBI_SKILLS, pbiSkillProblems } from "@powerloom/core";
import { defineTool } from "@agenttools/runtime";
import { z } from "zod";
import { evidenceInput, optionalEvidenceInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import type { Evidence } from "../models/Evidence";
import { relevantPageProblems, relevantPagesInput } from "../relevantPages";
import type { RefinementOutput } from "../refinement/models/RefinementOutput";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { BetterRefinementDraft } from "./models/BetterRefinementDraft";
import type { RefinementDetails } from "./models/RefinementDetails";

type Input = z.infer<z.ZodObject<typeof INPUT>>;

export const REFINEMENT_TOOL = "write_refinement";

const NEW_TASK = /^new:(\d+)$/;
const ITEM_ID = /^[A-Z]{1,3}-\d+(-\d+)?$/;

const evidencedItem = z.object({ what: z.string().min(1), evidence: evidenceInput });

const INPUT = {
  summary: z.string().min(1).describe("2-4 plain sentences: what the PBI asks for and why; a bug: symptoms, expected result, where seen"),
  scope_in: z.array(z.string()).describe("What is in scope"),
  scope_out: z.array(z.string()).describe("What is explicitly out of scope"),
  ac_gaps: z.array(z.object({ gap: z.string(), suggestion: z.string() })).describe("Missing, ambiguous or untestable acceptance criteria, each with a suggested wording"),
  sources: z.array(evidencedItem).describe("Everything you collected (PBI, parent, attachments, linked documents, pages, docs, related PBIs, answers), one each, and what it gave"),
  repos: z.array(z.object({
    name: z.string().min(1).describe("A repo from list_repos"),
    reason: z.string().min(1),
    evidence: optionalEvidenceInput.describe("The code that proves it; none marks the pick unverified"),
  })).describe("Repos the work touches"),
  affected_areas: z.array(z.object({
    area: z.string().min(1).describe("Feature, screen, service, event, job or data"),
    change: z.string().min(1).describe("What changes there, or what must not break"),
    evidence: evidenceInput,
  })),
  test_data: z.object({
    applicable: z.boolean().describe("Does the work need data to be tested or reproduced?"),
    given: z.array(evidencedItem).default([]).describe("What the PBI's description, notes, attachments or answers give: records, ids, environments, payloads, steps"),
    missing: z.array(z.string()).default([]).describe("What is still needed; ask the user for it with hand_off"),
    reason: z.string().min(1).describe("Why it is or isn't applicable"),
  }),
  dependencies: z.array(evidencedItem).describe("Systems, events, data, other PBIs or releases it relies on; not blocking"),
  blockers: z.array(z.object({
    what: z.string().min(1),
    resolved_by: z.string().min(1).describe("The task that resolves it: new:<n> for one you created with create_task or hand_off, or an existing item id"),
    evidence: evidenceInput,
  })).describe("What stops development now; each one resolved by a task"),
  assumptions: z.array(z.string()).describe("Assumptions you made, each marked (assumption)"),
  relevant_docs: z.array(z.object({ path: z.string(), why: z.string() })).describe("Docs research and design should read, and why"),
  skills: z.array(z.object({ name: z.string(), reason: z.string() })).default([]).describe(`Up to ${MAX_PBI_SKILLS} skills from list_skills that help the later agents on this PBI, each with why`),
  relevant_pages: relevantPagesInput,
  status: z.enum(["complete", "partial", "blocked"]).describe("complete: developable or every gap has a task; partial: what you have so far; blocked: something stops you, named in blockers"),
  next_reason: z.string().min(1).describe("Why the tasks you created are needed, or why none is"),
};

// Better Refinement's result. Each call replaces the previous one; create the tasks a blocker points at first. A
// blocker's `new:<n>` is checked against the tasks create_task and hand_off noted in this run (the toolset's, shared with writers).
export function createRefinementTool(draft: BetterRefinementDraft, readLog: ReadLog, availableSkills: string[], createdTasks: readonly CreatedTask[]) {
  return defineTool({
    name: REFINEMENT_TOOL,
    description: "Save the refinement. Write it once you know enough (status partial is fine) and call again to replace it. Every statement cites its sources; create the tasks your blockers point at before you name them here. The estimate goes to record_estimate: the run isn't complete without it.",
    input: INPUT,
    handler: async (input: Input) => {
      const problems = refinementProblems(input, createdTasks.length, readLog, availableSkills);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      draft.refinement = { ...readableRefinement(input), details: toDetails(input) };
      draft.pages = input.relevant_pages;

      return { text: `Refinement saved (${input.status}).` };
    },
    replayOnResume: true,
  });
}

function refinementProblems(input: Input, created: number, readLog: ReadLog, availableSkills: string[]): string[] {
  return [
    ...evidenceProblems(citedEvidence(input), readLog),
    ...pbiSkillProblems(input.skills.map((skill) => skill.name), availableSkills),
    ...relevantPageProblems(input.relevant_pages),
    ...input.blockers.filter((blocker) => !isKnownTask(blocker.resolved_by, created)).map((blocker) => `blocker "${blocker.what}" is resolved by "${blocker.resolved_by}", which is neither an item id nor a task you created (new:<n>)`),
  ];
}

function citedEvidence(input: Input): Evidence[] {
  const groups = [input.sources, input.repos, input.affected_areas, input.test_data.given, input.dependencies, input.blockers];

  return groups.flatMap((items) => items.flatMap((item) => item.evidence));
}

function isKnownTask(ref: string, created: number): boolean {
  const match = NEW_TASK.exec(ref);

  return match ? Number(match[1]) >= 1 && Number(match[1]) <= created : ITEM_ID.test(ref);
}

// The columns every reader already shows (research, design, the PBI page and note); blockers join the dependencies and
// each repo says whether code proves it, so nothing is lost before the readers learn the details.
function readableRefinement(input: Input): RefinementOutput {
  return {
    summary: input.summary,
    scopeIn: input.scope_in,
    scopeOut: input.scope_out,
    acGaps: input.ac_gaps,
    dependencies: [...input.dependencies.map((item) => item.what), ...input.blockers.map((blocker) => `Blocker: ${blocker.what} (resolved by ${blocker.resolved_by})`)],
    repos: input.repos.map((repo) => ({ name: repo.name, reason: repo.evidence.length > 0 ? `${repo.reason} (code: ${repo.evidence.map((item) => item.ref).join(", ")})` : `${repo.reason} (unverified)` })),
    assumptions: input.assumptions,
    relevantDocs: input.relevant_docs,
    skills: input.skills,
  };
}

function toDetails(input: Input): RefinementDetails {
  return {
    version: 2,
    status: input.status,
    sources: input.sources,
    repos: input.repos,
    affectedAreas: input.affected_areas,
    testData: input.test_data,
    dependencies: input.dependencies,
    blockers: input.blockers.map((blocker) => ({ what: blocker.what, resolvedBy: blocker.resolved_by, evidence: blocker.evidence })),
    nextReason: input.next_reason,
  };
}
