import { approvalSteps } from "@powerloom/core";
import { HANDOFF_GATES, HANDOFF_INTENTS } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import type { ReadLog } from "../evidence/ReadLog";
import { stepInput } from "../humanTasks/humanTaskTool";
import { normalizeNotePath } from "../techWriter/notePaths";
import { taskFieldsInput, taskProblems } from "../taskCreation/createTaskTool";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";
import type { TaskTarget } from "../taskCreation/models/TaskTarget";
import { noteCreatedTask } from "../taskCreation/noteCreatedTask";
import { PERSON, USER, allowedTargets } from "../taskCreation/taskTargets";
import { handoffProblems } from "./handoffProblems";


const EXAMPLE = JSON.stringify({
  to: "person",
  item: "task",
  intent: "review",
  gate: "approve",
  title: "Review the plan for expired orders",
  package: { body: "The plan archives orders past their expiry in OrderArchiver (plan step 2). Check the cut-off.", results: ["RUN-812"], items: [], notes: ["shop/orders/expiry.md"] },
  goal: "Approve the plan or name the changes.",
  done_when: "approve, or the changes to make",
  effort: "lookup",
  reason: "Implementation starts only on an approved plan.",
  evidence: [{ source: "S0", ref: "PBI description", note: "orders past their expiry stay open" }],
  blocking: true,
});

type Input = z.infer<z.ZodObject<ReturnType<typeof inputShape>>>;

// The one hand-off tool every agent gets (user decision 2026-10-28): it hands work on to an agent task type the config
// allows or to a person (a human task or a question), with a package and what it asks. The run's commit creates the
// item, records the hand-off and the dependency; the task's settlement follows the intent.
export function createHandOffTool(canAssign: string[], tasks: CreatedTask[], guard: DuplicateGuard, readLog: ReadLog, limits: TaskCreationLimits): ToolDefinition<any> {
  const targets = allowedTargets(canAssign);

  return defineTool({
    name: "hand_off",
    description: describeTool(targets),
    input: inputShape(targets),
    handler: async (input: Input) => {
      const task = toCreatedTask(input);
      const problems = [...handoffProblems(input, tasks.length), ...taskProblems(task, tasks, readLog, limits)];

      return noteCreatedTask(task, problems, tasks, guard);
    },
    replayOnResume: true,
  });
}

function inputShape(targets: TaskTarget[]) {
  const receivers: [string, ...string[]] = [PERSON, ...targets.map((target) => target.type)];

  return {
    to: z.enum(receivers).describe("person, or the task type an agent takes"),
    item: z.enum(["task", "question"]).default("task").describe("For a person: a task to do, or a question to answer"),
    intent: z.enum(HANDOFF_INTENTS).describe("continue: the target carries the work on and you are done; ask: you wait for its answer and run again; review: a person reviews your output; return: send the work back upstream and you are done"),
    gate: z.enum(HANDOFF_GATES).default("none").describe("approve: what depends on it starts only once the person approves; answer: only once it is answered; none: once it closes in any way"),
    title: z.string().min(1).max(120),
    package: z.object({
      body: z.string().min(1).describe("Markdown the target reads first: what you did, what you hand over, what is still open"),
      results: z.array(z.string()).default([]).describe("Run results it should read, as RUN-<id>"),
      items: z.array(z.string()).default([]).describe("Item ids it should read, or new:<n> of a task you created earlier in this run"),
      notes: z.array(z.string()).default([]).describe("Docs vault notes it should read, e.g. shop/orders/note.md"),
    }),
    ...taskFieldsInput,
    options: z.array(z.string()).default([]).describe("Questions: the choices you see"),
    steps: z.array(stepInput).default([]).describe("Tasks for a person: what to do, step by step; none with gate approve, whose answers are fixed"),
    doc_path: z.string().nullable().default(null).describe("Docs tasks: the note's path in the docs vault"),
  };
}

function describeTool(targets: TaskTarget[]): string {
  const agents = targets.map((target) => `- ${target.type}: ${target.purpose}`);

  return [
    "Hand your work on, to an agent or a person, with a package the receiver reads first. Use it whenever someone else must continue, answer, review or redo what you did.",
    "Receivers:",
    "- person: decisions (item question, with options), access or actions no tool can do (item task, with steps), or a review of your output (intent review, gate approve: the person answers approve or changes).",
    ...agents,
    "Chain: hand a review to a person, then the next agent with depends_on: [\"new:<n>\"] of that review; it starts only as the gate allows.",
    `Example: ${EXAMPLE}`,
  ].join("\n");
}

function toCreatedTask(input: Input): CreatedTask {
  return {
    assignee: input.to === PERSON ? USER : input.to,
    kind: input.item,
    title: input.title,
    goal: input.goal,
    doneWhen: input.done_when,
    outOfScope: input.out_of_scope,
    effort: input.effort,
    reason: input.reason,
    evidence: input.evidence,
    blocking: input.blocking,
    dependsOn: input.depends_on,
    options: input.options,
    steps: input.gate === "approve" && input.steps.length === 0 ? approvalSteps(`"${input.title}"`) : input.steps,
    docPath: input.doc_path === null ? null : normalizeNotePath(input.doc_path),
    handoff: { intent: input.intent, gate: input.gate, package: { body: input.package.body, refs: { results: input.package.results, items: input.package.items, notes: input.package.notes } } },
  };
}
