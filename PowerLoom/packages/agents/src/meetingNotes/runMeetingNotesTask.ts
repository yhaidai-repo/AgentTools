import { agentRun, localItem } from "@powerloom/db";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { createReadPbiTool } from "../pbiContext/readPbiTool";
import { createAgentDocTools, numberOption } from "../stage";
import { commitMeetingNotes } from "./commitMeetingNotes";
import { createFollowUpTool, findPbisTool, writeMeetingNotesTool } from "./meetingNotesTools";
import type { MeetingNotesDraft } from "./models/MeetingNotesDraft";
import type { MeetingTaskData } from "./models/MeetingTaskData";

type ItemRow = typeof localItem.$inferSelect;
type Stage = typeof agentRun.$inferSelect["stage"];

// A long meeting's transcript is ~1 000 characters a minute; two hours fit, longer ones are cut with a note.
const MAX_TRANSCRIPT_CHARS = 150_000;

// One meeting task (MT-…, from the audio-capture tool; user decision 2026-10-14): the agent reads the transcript, writes
// the notes (summary, decisions, action items, work items, open questions) into the meeting's vault and creates the
// follow-ups the meeting asked for.
export async function runMeetingNotesTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps, agent } = context;
  const info: AgentRunInfo = {
    stage: agent.id as Stage,
    pbiId: null,
    itemId: task.id,
    labels: { agent: agent.id, item: task.id },
    model: agent.model,
    promptVersion: context.prompt.version,
  };
  const draft: MeetingNotesDraft = { notes: null, followUps: [] };
  const session = await AgentRunSession.begin(deps, info);
  const ran = await session.execute(info, () => prepare(context, session, task, draft));

  return session.finish(ran, () => commitMeetingNotes(context, task, session.runId, draft));
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, draft: MeetingNotesDraft): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as MeetingTaskData;

  if (!deps.vaults) {
    throw new Error("the vaults root isn't mounted for the agent-runner (VAULTS_DIR)");
  }

  const transcript = await readTranscript(deps.vaults.root, task.vault, data.transcriptNote);
  const firstMessage = buildFirstMessage(task, data, transcript);

  await session.phase("first-message", { task: task.id, vault: task.vault, transcriptChars: transcript.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      writeMeetingNotesTool(draft),
      createFollowUpTool(deps.db, task.vault, agent.canAssign, draft.followUps, numberOption(agent, "maxTasksPerRun", 8)),
      findPbisTool(deps.db, task.vault),
      createReadPbiTool(deps.db, deps.vaultRoot),
      ...createAgentDocTools(deps, agent.id, session.runId),
      ...skills.tools,
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.notes !== null,
  };
}

async function readTranscript(vaultsRoot: string, vault: string, notePath: string): Promise<string> {
  const text = await readFile(join(vaultsRoot, vault, notePath), "utf8");

  return text.length <= MAX_TRANSCRIPT_CHARS ? text : `${text.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n(transcript cut at ${MAX_TRANSCRIPT_CHARS} characters)`;
}

function buildFirstMessage(task: ItemRow, data: MeetingTaskData, transcript: string): string {
  return [
    `Task ${task.id}: ${task.title}`,
    `Vault: ${task.vault} · recorded ${data.startedAt} · ${Math.round(data.durationSec / 60)} min · voices: ${data.speakers.join(", ")}`,
    `<transcript path="${data.transcriptNote}">\n${transcript}\n</transcript>`,
    "Write the notes with write_meeting_notes, create the follow-ups the meeting asked for, then stop.",
  ].join("\n\n");
}
