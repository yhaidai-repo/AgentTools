import { localItem, workItem } from "@adoa/db";
import { pbiNoteName } from "@adoa/vault";
import { eq } from "drizzle-orm";
import type { ChatPlan } from "../models/ChatPlan";
import type { ChatRequest } from "../models/ChatRequest";
import type { CommandContext } from "../models/CommandContext";
import type { ContinueEnv } from "../models/ContinueEnv";
import type { FindingData } from "../models/FindingData";
import type { ItemChat } from "../models/ItemChat";
import type { Outcome } from "../models/Outcome";
import { pbiRepoNames } from "../pbiRepos";
import { backlogHostPath, chatHostFolder, docsProjectHostPath, folderOf, repoHostPaths } from "./hostPaths";
import { ITEM_CHATS } from "./itemChats";

type ItemRow = typeof localItem.$inferSelect;

// A finding's text in the prompt is cut here, so the prompt stays well under a link's limits.
const FINDING_TEXT_MAX = 6_000;
const OPEN_STATUSES = ["open", "in-progress"];

// A chat on a question, human task or finding: its notes are in the vault already, so nothing is prepared and the
// item's status doesn't change (user decision 2026-10-05).
export async function itemChatPlan(env: ContinueEnv, context: CommandContext, itemId: string): Promise<Outcome<ChatPlan>> {
  const [item] = await context.db.select().from(localItem).where(eq(localItem.id, itemId));
  const chat = item ? ITEM_CHATS[item.kind] : undefined;

  if (!item || !chat) {
    return { ok: false, error: item ? `No chat for a ${item.kind}.` : `${itemId} not found.` };
  }

  if (!OPEN_STATUSES.includes(item.status)) {
    return { ok: false, error: `${item.id} is ${item.status}.` };
  }

  const request = item.pbiId === null ? findingRequest(env, item, chat) : await pbiItemRequest(env, context, item, chat, item.pbiId);

  return request.ok ? { ok: true, value: { request: request.value, prepare: async () => null } } : request;
}

// An item under a PBI: its note and the PBI's notes, with the PBI's repos.
async function pbiItemRequest(env: ContinueEnv, context: CommandContext, item: ItemRow, chat: ItemChat, adoId: number): Promise<Outcome<ChatRequest>> {
  const [pbi] = await context.db.select({ vaultPath: workItem.vaultPath }).from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi?.vaultPath || !item.vaultPath) {
    return { ok: false, error: "Needs the item's note under a prepared PBI." };
  }

  const pbiFolder = backlogHostPath(env, item.vault, folderOf(pbi.vaultPath));
  const read = `Read ${backlogHostPath(env, item.vault, item.vaultPath)}, then the PBI's notes in ${pbiFolder} (${pbiNoteName(adoId)}.md, the refinement, the design when present, research/), and the code they cite where the briefing needs it.`;
  const folders = repoHostPaths(env, await pbiRepoNames(context.db, adoId));

  return { ok: true, value: itemRequest(env, item, chat, [], folders, [read, ...registersStep(env, item)]) };
}

// A finding without a PBI (e.g. from a tech-writer task) has no note: its text goes in the request, and its project's
// index names the repo.
function findingRequest(env: ContinueEnv, item: ItemRow, chat: ItemChat): Outcome<ChatRequest> {
  const registers = registersStep(env, item);

  if (item.kind !== "finding" || registers.length === 0) {
    return { ok: false, error: "Needs a PBI, or a finding with its project." };
  }

  const data = item.data as FindingData;
  const intro = [
    `The finding (${data.type === "issue" ? "known issue" : "open question"}, project ${data.project}):`,
    (item.body ?? "").slice(0, FINDING_TEXT_MAX),
    ...(data.default?.length ? [`Default: ${data.default.join("; ")}`] : []),
    ...(data.options?.length ? [`Options: ${data.options.join("; ")}`] : []),
  ];
  const index = `${docsProjectHostPath(env, item.vault, data.project)}/${data.project}-index.md`;

  return { ok: true, value: itemRequest(env, item, chat, intro, [], [`Add the repo named by the \`repo:\` line of ${index} to this session.`, ...registers]) };
}

function itemRequest(env: ContinueEnv, item: ItemRow, chat: ItemChat, intro: string[], extraFolders: string[], reading: string[]): ChatRequest {
  const briefing = `Answer with a briefing in plain language, short, in this order:\n${chat.briefing.map((part) => `   - ${part}`).join("\n")}`;

  return { title: `${chat.opening} ${item.id}: ${item.title}`, intro, folder: chatHostFolder(env, item.vault), extraFolders, steps: [...reading, briefing, chat.ending] };
}

// A finding goes into its project's register in its vault, which says what is recorded already.
function registersStep(env: ContinueEnv, item: ItemRow): string[] {
  const project = item.kind === "finding" ? (item.data as FindingData | null)?.project : undefined;

  if (!project) {
    return [];
  }

  const folder = docsProjectHostPath(env, item.vault, project);

  return [`Read the registers ${folder}/${project}-open-questions.md and ${folder}/${project}-known-issues.md, and the code the finding cites.`];
}
