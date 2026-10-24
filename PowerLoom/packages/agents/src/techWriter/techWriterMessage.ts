import type { localItem } from "@powerloom/db";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { acceptanceCriteriaBlock, isUserTask, userRequestBlock } from "../tasks/userTasks";
import type { ActualizeTaskData } from "./models/ActualizeTaskData";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { TaskVault } from "./models/TaskVault";
import { modeOf } from "./taskVault";

type ItemRow = typeof localItem.$inferSelect;

// What a tech-writer task's first message adds to the generic one (the task, the PBI, the repos): the draft or note
// to work on, the project's index and, for a request, the vault's.
export function techWriterMessage(vault: TaskVault, task: ItemRow): Promise<string> {
  const mode = modeOf(task);

  if (mode === "actualize") {
    return actualizeMessage(vault, task, task.data as ActualizeTaskData);
  }

  return mode === "request" ? requestMessage(vault, task) : draftMessage(vault, task, task.data as DraftTaskData);
}

async function draftMessage(vault: TaskVault, task: ItemRow, data: DraftTaskData): Promise<string> {
  const draftText = await readFile(join(vault.root, data.path), "utf8");

  return [
    "Move this draft into the docs vault: verify it, merge it into its target, then the draft is deleted.",
    `<docs-task>\nMode: draft\nDraft: ${data.path}\nProject: ${data.project}\nTarget: ${data.target}\nSource: ${data.source}\n</docs-task>`,
    `<draft>\n${draftText.trim()}\n</draft>`,
    await projectIndexBlock(vault, data.project),
  ].join("\n\n");
}

async function actualizeMessage(vault: TaskVault, task: ItemRow, data: ActualizeTaskData): Promise<string> {
  const noteText = await readFile(join(vault.root, data.path), "utf8");
  const suspects = data.suspectFacts.map((fact) => `- ${fact}`).join("\n") || "- (none named)";
  const userAsked = isUserTask(task);
  const why = userAsked ? "the user asked for it" : "the vault review found it outdated";

  return [
    `Actualize this note: ${why}. Re-verify it against the code and rewrite it in place.`,
    `<docs-task>\nMode: actualize\nVault: ${vault.name}\nNote: ${data.path}\nProject: ${data.project}\nAsked by: ${userAsked ? "the user" : data.reviewTask}\n</docs-task>`,
    `<reasons>\n${data.reasons}\n</reasons>`,
    acceptanceCriteriaBlock(task),
    `<suspect-facts>\n${suspects}\n</suspect-facts>`,
    `<note>\n${noteText.trim()}\n</note>`,
    await projectIndexBlock(vault, data.project),
  ].filter(Boolean).join("\n\n");
}

// No draft and no note: the user's request, with the vault's entry note to start finding the notes it is about.
async function requestMessage(vault: TaskVault, task: ItemRow): Promise<string> {
  const index = await readFile(join(vault.root, "index.md"), "utf8").catch(() => "(no index.md)");

  return [
    "Do what the user asks in the docs vault: find the notes it is about, then update them or create new ones as the vault rules say.",
    `<docs-task>\nMode: request\nVault: ${vault.name}\n</docs-task>`,
    userRequestBlock(task),
    `<vault-index>\n${index.trim()}\n</vault-index>`,
  ].filter(Boolean).join("\n\n");
}

async function projectIndexBlock(vault: TaskVault, project: string): Promise<string> {
  const index = await readFile(join(vault.root, project, `${project}-index.md`), "utf8").catch(() => "(no project index)");

  return `<project-index>\n${index.trim()}\n</project-index>`;
}
