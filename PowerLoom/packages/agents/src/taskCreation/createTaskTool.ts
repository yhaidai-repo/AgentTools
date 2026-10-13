import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import { evidenceInput } from "../evidence/evidenceInput";
import { evidenceProblems } from "../evidence/evidenceProblems";
import type { ReadLog } from "../evidence/ReadLog";
import { missingQueryProblem, reasonInput, stepInput } from "../humanTasks/humanTaskTool";
import { notePathProblem } from "../techWriter/notePaths";
import type { CreatedTask } from "./models/CreatedTask";
import type { TaskCreationLimits } from "./models/TaskCreationLimits";
import type { TaskTarget } from "./models/TaskTarget";
import { USER, allowedTargets, targetOf } from "./taskTargets";

const NEW_TASK = /^new:(\d+)$/;
const ITEM_ID = /^[A-Z]{1,3}-\d+(-\d+)?$/;

const EXAMPLE = JSON.stringify({
  assignee: "research",
  kind: "task",
  title: "Why do expired signals stay active?",
  goal: "The grid shows signals past their IneffectiveDate (S0). What should archive them is unknown.",
  done_when: "The writer that should change their state is named, with evidence, and why it did not run.",
  out_of_scope: "Where the grid reads them",
  effort: "trace",
  reason: "The fix depends on the cause.",
  evidence: [{ source: "S0", ref: "PBI description", note: "the symptom as reported" }],
  blocking: true,
  depends_on: [],
});

type Input = z.infer<z.ZodObject<ReturnType<typeof inputShape>>>;

// The one task tool of the Better agents (chaining v2): the agent decides what work comes next, among the task types its
// config lets it create and the user; any agent that handles the type takes it. Tasks are only noted here; the run's
// commit writes them.
export function createTaskTool(canAssign: string[], tasks: CreatedTask[], guard: DuplicateGuard, readLog: ReadLog, limits: TaskCreationLimits): ToolDefinition<any> {
  const targets = allowedTargets(canAssign);

  return defineTool({
    name: "create_task",
    description: describeTool(targets, limits),
    input: inputShape(targets),
    handler: async (input: Input) => {
      const task = toCreatedTask(input);
      const problems = taskProblems(task, tasks, readLog, limits);

      if (problems.length > 0) {
        return { text: `Not created, fix and retry: ${problems.join("; ")}.`, isError: true };
      }

      const duplicate = guard.check(guardKindOf(task), task.goal);

      if (duplicate) {
        return { text: duplicate, isError: true };
      }

      tasks.push(task);
      guard.remember(guardKindOf(task), `new:${tasks.length}`, task.goal);

      return { text: `Noted as new:${tasks.length} for ${task.assignee}; it is created when your run succeeds.` };
    },
  });
}

function inputShape(targets: TaskTarget[]) {
  const assignees: [string, ...string[]] = [USER, ...targets.map((target) => target.type)];

  return {
    assignee: z.enum(assignees).describe("The task type (any agent taking that type picks it up), or user"),
    kind: z.enum(["task", "question"]).describe("question: a decision only the user can make, with options; task: work for an agent, or an action for the user"),
    title: z.string().min(1).max(120),
    goal: z.string().min(1).describe("The problem or question and the facts known so far; mark guesses (inferred)"),
    done_when: z.string().min(1).describe("The answer or result that closes it"),
    out_of_scope: z.string().nullable().default(null).describe("What it must not cover, e.g. a sibling task's id"),
    effort: z.enum(["lookup", "trace", "spike"]).describe("lookup: a quick check; trace: follow code, data or logs; spike: an open investigation"),
    reason: reasonInput("Why it is needed now: what its answer changes"),
    evidence: evidenceInput,
    blocking: z.boolean().describe("true when the PBI can't be developed until it is closed"),
    depends_on: z.array(z.string()).default([]).describe("Item ids, or new:<n> for a task you created earlier in this run, that must close first"),
    options: z.array(z.string()).default([]).describe("Questions: the choices you see"),
    steps: z.array(stepInput).default([]).describe("Tasks for the user: what to do, step by step"),
    doc_path: z.string().nullable().default(null).describe("Docs tasks: the note's path in the docs vault, e.g. pvs/signals/note.md"),
  };
}

function describeTool(targets: TaskTarget[], limits: TaskCreationLimits): string {
  const agents = targets.map((target) => `- ${target.type}: ${target.purpose}`);

  return [
    "Create a task for another agent or for the user; you decide what work comes next. Create one only when its answer changes the outcome.",
    "Assignees (a task type, picked up by any agent taking that type, or the user):",
    ...agents,
    "- user: decisions (kind question, with options), access or actions no tool can do (kind task, with steps).",
    "Hand on the problem and its evidence, not your guess. Name what it depends on, and mark it blocking when the PBI can't be developed without it.",
    `Agent tasks: yours would be depth ${limits.depth + 1} of ${limits.maxDepth}; at most ${limits.maxPerRun} per run.`,
    `Example: ${EXAMPLE}`,
  ].join("\n");
}

function toCreatedTask(input: Input): CreatedTask {
  return {
    assignee: input.assignee,
    kind: input.kind,
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
    steps: input.steps,
    docPath: input.doc_path,
  };
}

export function taskProblems(task: CreatedTask, tasks: CreatedTask[], readLog: ReadLog, limits: TaskCreationLimits): string[] {
  return [...shapeProblems(task), ...dependencyProblems(task.dependsOn, tasks.length), ...evidenceProblems(task.evidence, readLog), ...limitProblems(task, tasks, limits)];
}

function shapeProblems(task: CreatedTask): string[] {
  return [questionForAgentProblem(task), userTaskStepsProblem(task), docPathProblem(task)].filter(isProblem);
}

function questionForAgentProblem(task: CreatedTask): string | null {
  return task.kind === "question" && task.assignee !== USER ? "a question goes to the user; give an agent a task" : null;
}

function userTaskStepsProblem(task: CreatedTask): string | null {
  if (task.assignee !== USER || task.kind !== "task") {
    return null;
  }

  return task.steps.length === 0 ? "a task for the user needs steps" : missingQueryProblem(task.steps);
}

function docPathProblem(task: CreatedTask): string | null {
  const target = targetOf(task.assignee);

  if (!target?.needsDocPath) {
    return null;
  }

  return task.docPath ? notePathProblem(task.docPath) : `${target.type} needs doc_path: the note to fix`;
}

function dependencyProblems(dependsOn: string[], createdInRun: number): string[] {
  return dependsOn
    .filter((id) => !isKnownDependency(id, createdInRun))
    .map((id) => `depends_on "${id}" is neither an item id nor new:<n> of a task you created earlier in this run`);
}

function isKnownDependency(id: string, createdInRun: number): boolean {
  const created = NEW_TASK.exec(id);

  return created ? Number(created[1]) >= 1 && Number(created[1]) <= createdInRun : ITEM_ID.test(id);
}

// The caps stop a chain that keeps creating work (repetition and missing stop conditions are the most common
// multi-agent failures); the user is never capped, so an agent at a cap can still hand the gap to a person.
function limitProblems(task: CreatedTask, tasks: CreatedTask[], limits: TaskCreationLimits): string[] {
  if (task.assignee === USER) {
    return [];
  }

  const inRun = tasks.filter((created) => created.assignee !== USER).length;

  return [depthProblem(limits), runCapProblem(inRun, limits), pbiCapProblem(inRun, limits)].filter(isProblem);
}

function depthProblem(limits: TaskCreationLimits): string | null {
  return limits.depth >= limits.maxDepth ? `depth limit ${limits.maxDepth} reached: write the gap into your result, or ask the user` : null;
}

function runCapProblem(inRun: number, limits: TaskCreationLimits): string | null {
  return inRun >= limits.maxPerRun ? `at most ${limits.maxPerRun} agent tasks per run` : null;
}

function pbiCapProblem(inRun: number, limits: TaskCreationLimits): string | null {
  const created = limits.createdOnPbi + inRun;

  if (created < limits.maxPerPbi) {
    return null;
  }

  return `agents already created ${created} tasks on this PBI (cap ${limits.maxPerPbi}): the work may be going in circles; create a task for the user that says what is still open`;
}

function guardKindOf(task: CreatedTask): string {
  if (task.assignee === USER) {
    return task.kind === "question" ? "question" : "human";
  }

  return targetOf(task.assignee)!.kind;
}

function isProblem(problem: string | null): problem is string {
  return problem !== null;
}
