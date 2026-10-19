import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { workItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { missingQueryProblem, stepInput } from "../humanTasks/humanTaskTool";
import { USER, allowedTargets } from "../taskCreation/taskTargets";
import type { MeetingFollowUp } from "./models/MeetingFollowUp";
import type { MeetingNotesDraft } from "./models/MeetingNotesDraft";

const SAID_AT = z.string().regex(/^\d{2}:\d{2}:\d{2}$/).describe("The transcript time, e.g. 00:12:03");

// The required output: the meeting's notes, once, at the end (a second call replaces the first).
export function writeMeetingNotesTool(draft: MeetingNotesDraft): ToolDefinition<any> {
  return defineTool({
    name: "write_meeting_notes",
    description: "The meeting's notes, once, at the end; a later call replaces them. Write in the meeting's main language; keep names and terms as spoken.",
    input: {
      title: z.string().min(1).max(100).describe("What the meeting was about, short"),
      summary: z.string().min(1).describe("3-8 sentences: what was discussed and where it ended"),
      participants: z.array(z.object({ label: z.string(), who: z.string().nullable().default(null) })).describe("Every voice label of the transcript; `who` when the talk names the person"),
      decisions: z.array(z.string()).default([]),
      action_items: z.array(z.object({ owner: z.string(), what: z.string(), due: z.string().nullable().default(null), said_at: SAID_AT })).default([]),
      pbis: z.array(z.object({ id: z.number().int().positive().nullable(), title: z.string(), said: z.string(), said_at: SAID_AT })).default([]),
      open_questions: z.array(z.string()).default([]),
      corrections: z.array(z.string()).default([]).describe("Transcript errors you are sure of, as 'heard → meant'"),
    },
    handler: async (input) => {
      draft.notes = {
        title: input.title,
        summary: input.summary,
        participants: input.participants,
        decisions: input.decisions,
        actionItems: input.action_items.map((item) => ({ owner: item.owner, what: item.what, due: item.due, saidAt: item.said_at })),
        pbis: input.pbis.map((pbi) => ({ id: pbi.id, title: pbi.title, said: pbi.said, saidAt: pbi.said_at })),
        openQuestions: input.open_questions,
        corrections: input.corrections,
      };

      return { text: "Notes recorded; they are written to the vault when the run succeeds." };
    },
    replayOnResume: true,
  });
}

// Work items of the meeting's vault by words of their title or by id: a meeting rarely says the number.
export function findPbisTool(db: PowerLoomDb, vault: string): ToolDefinition<any> {
  return defineTool({
    name: "find_pbis",
    description: "Find work items of this vault in PowerLoom by words of their title (any language) or by id. Returns id, title, ADO state and pipeline status.",
    input: { query: z.string().min(2).describe("A few title words, or an id") },
    handler: async ({ query }) => {
      const rows = await db
        .select({ id: workItem.adoId, title: workItem.title, state: workItem.adoState, status: workItem.pipelineStatus })
        .from(workItem)
        .where(and(eq(workItem.vault, vault), matches(query)))
        .limit(15);

      return { text: rows.length === 0 ? "No work item matches." : rows.map((row) => `PBI-${row.id} · ${row.title} · ${row.state} · ${row.status}`).join("\n") };
    },
  });
}

function matches(query: string) {
  const id = Number(query.replace(/^\D+/, ""));
  const words = query.split(/\s+/).filter((word) => word.length > 2).map((word) => ilike(workItem.title, `%${word}%`));

  return Number.isInteger(id) && id > 0 ? or(eq(workItem.adoId, id), ...words) : or(...words);
}

// A task or question the meeting asked for, on the PBI it concerns when there is one. A design needs its PBI; a
// task for the user needs steps; a question goes to the user with its options. Written only when the run succeeds.
export function createFollowUpTool(db: PowerLoomDb, vault: string, canAssign: string[], followUps: MeetingFollowUp[], maxPerRun: number): ToolDefinition<any> {
  const assignees: [string, ...string[]] = [USER, ...allowedTargets(canAssign).map((target) => target.type)];

  return defineTool({
    name: "create_follow_up",
    description: [
      "Create a task or question the meeting asked for. Only for work the meeting clearly agreed on or a question it left open for the user.",
      `Assignees: user (actions the user owns: kind task with steps; decisions: kind question with options), ${assignees.slice(1).join(", ")} (agents; give the PBI).`,
      `At most ${maxPerRun} per run.`,
    ].join(" "),
    input: {
      assignee: z.enum(assignees),
      kind: z.enum(["task", "question"]),
      title: z.string().min(1).max(120),
      goal: z.string().min(1).describe("What was said and what is needed, with the facts from the meeting"),
      done_when: z.string().min(1),
      reason: z.string().min(1).describe("Why the meeting wants it"),
      pbi_id: z.number().int().positive().nullable().default(null).describe("The work item it belongs to (find_pbis)"),
      said_at: SAID_AT,
      quote: z.string().min(1).describe("The transcript line it comes from"),
      options: z.array(z.string()).default([]),
      steps: z.array(stepInput).default([]),
    },
    handler: async (input) => {
      const problem = shapeProblem(input) ?? (followUps.length >= maxPerRun ? `at most ${maxPerRun} follow-ups per run` : null) ?? await pbiProblem(db, vault, input.pbi_id);

      if (problem) {
        return { text: `Not created, fix and retry: ${problem}.`, isError: true };
      }

      followUps.push({ pbiId: input.pbi_id, task: toCreatedTask(input) });

      return { text: `Noted as follow-up ${followUps.length}; it is created when your run succeeds.` };
    },
    replayOnResume: true,
  });
}

type FollowUpInput = { assignee: string; kind: "task" | "question"; title: string; goal: string; done_when: string; reason: string; pbi_id: number | null; said_at: string; quote: string; options: string[]; steps: z.infer<typeof stepInput>[] };

function shapeProblem(input: FollowUpInput): string | null {
  if (input.kind === "question") {
    return input.assignee !== USER ? "a question goes to the user" : input.options.length < 2 ? "a question needs at least two options" : null;
  }

  if (input.assignee === USER) {
    return input.steps.length === 0 ? "a task for the user needs steps" : missingQueryProblem(input.steps);
  }

  return input.assignee === "design" && input.pbi_id === null ? "a design task needs its PBI (find_pbis)" : null;
}

async function pbiProblem(db: PowerLoomDb, vault: string, pbiId: number | null): Promise<string | null> {
  if (pbiId === null) {
    return null;
  }

  const [row] = await db.select({ id: workItem.adoId }).from(workItem).where(and(eq(workItem.adoId, pbiId), eq(workItem.vault, vault)));

  return row ? null : `PBI-${pbiId} isn't in PowerLoom's ${vault}; mention it in the notes instead`;
}

function toCreatedTask(input: FollowUpInput) {
  return {
    assignee: input.assignee,
    kind: input.kind,
    title: input.title,
    goal: input.goal,
    doneWhen: input.done_when,
    outOfScope: null,
    effort: "lookup" as const,
    reason: input.reason,
    evidence: [{ source: "transcript", ref: input.said_at, note: "said in the meeting", quote: input.quote }],
    blocking: false,
    dependsOn: [],
    options: input.options,
    steps: input.steps,
    docPath: null,
  };
}
