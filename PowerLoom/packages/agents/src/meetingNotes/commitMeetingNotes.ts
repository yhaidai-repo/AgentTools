import { readAdoSettings } from "@powerloom/core";
import { agentRun, localItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { TaskContext } from "../models/TaskContext";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import type { MeetingNotesDraft } from "./models/MeetingNotesDraft";
import type { MeetingTaskData } from "./models/MeetingTaskData";
import { meetingNotesPath, renderMeetingNotes } from "./renderMeetingNotes";

type ItemRow = typeof import("@powerloom/db").localItem.$inferSelect;

// A successful run: the notes into the meeting's vault (a free name next to the transcript), the follow-ups as tasks
// under the meeting task, the note's path and the follow-ups as the task's resolution.
export async function commitMeetingNotes(context: TaskContext, task: ItemRow, runId: number, draft: MeetingNotesDraft): Promise<void> {
  const { db, vaults } = context.deps;
  const data = task.data as MeetingTaskData;
  const notes = draft.notes!;
  const writer = vaults!.writer(task.vault);
  const path = await freePath(writer, meetingNotesPath(data, notes.title));

  await writer.writeNote(path, renderMeetingNotes(notes, data, task.id, await pbiUrlOf(context, task.vault)));

  const taskIds = await commitFollowUps(context, task, runId, draft);
  const resolution = [`Notes: ${path}`, ...taskIds.map((id) => `Follow-up: ${id}`)].join("\n");

  await db.update(localItem).set({ resolution }).where(eq(localItem.id, task.id));
  await db.update(agentRun).set({ outputs: [`notes: ${path}`, ...taskIds] }).where(eq(agentRun.id, runId));
}

// Each follow-up on its own PBI (or none), all under the meeting task.
async function commitFollowUps(context: TaskContext, task: ItemRow, runId: number, draft: MeetingNotesDraft): Promise<string[]> {
  const ids: string[] = [];

  for (const followUp of draft.followUps) {
    const commit = { pbiId: followUp.pbiId, vault: task.vault, parentTaskId: task.id, runId, depth: 1, docsVault: task.vault };

    ids.push(...await commitCreatedTasks(context.deps.db, commit, [followUp.task]));
  }

  return ids;
}

async function freePath(writer: { readNote(path: string): Promise<string | null> }, path: string): Promise<string> {
  let candidate = path;
  let attempt = 1;

  while ((await writer.readNote(candidate)) !== null) {
    attempt++;
    candidate = path.replace(/\.md$/, `-${attempt}.md`);
  }

  return candidate;
}

async function pbiUrlOf(context: TaskContext, vault: string): Promise<((id: number) => string) | null> {
  const ado = await readAdoSettings(context.deps.db, vault);

  if (!ado?.orgUrl || !ado.project) {
    return null;
  }

  return (id: number) => `${ado.orgUrl.replace(/\/+$/, "")}/${encodeURIComponent(ado.project)}/_workitems/edit/${id}`;
}
