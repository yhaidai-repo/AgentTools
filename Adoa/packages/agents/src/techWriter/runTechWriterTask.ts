import { localItem } from "@adoa/db";
import { createDocTools, createRepoTools, type RepoRef } from "@agenttools/runtime";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { resolveRepos, reposByName } from "../research/resolveRepos";
import { numberOption } from "../stage";
import { commitTechWriter } from "./commitTechWriter";
import { requireNoDraftLinks } from "./draftLinks";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { projectRepoName } from "./projectRepo";
import { createTechWriterTools } from "./techWriterTools";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "tech-writer";

interface TechWriterRun {
  repos: RepoRef[];
  acquired: RepoRef[];
  draft: TechWriterDraft;
}

// One tech-writer task (WT-…): one run that moves one draft into the docs vault (user decision 2026-10-02). The repos it
// took from the cache are released whatever happens.
export async function runTechWriterTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const docsVault = deps.docsVault;

  if (!docsVault) {
    throw new Error("the docs vault isn't writable for the agent-runner (DOCS_VAULT_NAME and its mount)");
  }

  const info: AgentRunInfo = {
    stage: "tech-writer",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: TechWriterRun = { repos: [], acquired: [], draft: { edits: [], findings: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      await requireNoDraftLinks(deps.docsRoot, (task.data as DraftTaskData).draft, run.draft.edits);
      await commitTechWriter(deps.db, docsVault, task, session.runId, run.draft);
    };

    return await session.finish(ran, commit);
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

// The repository first (user decision 2026-10-02), then the draft and the vault rules; each step is a traced phase.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: TechWriterRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as DraftTaskData;

  await session.phase("context", { task: task.id, draft: data.draft, project: data.project, target: data.target });
  run.repos = await draftRepos(context, task, data);
  await session.phase("repos", { repos: run.repos.map((repo) => repo.name) });
  await deps.repoCache.acquire(run.repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  run.acquired = run.repos;

  const firstMessage = await buildFirstMessage(context, task, data, run.repos);
  const vaultRules = await readFile(join(deps.docsRoot, "AGENTS.md"), "utf8");

  await session.phase("first-message", { chars: firstMessage.length, vaultRulesChars: vaultRules.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, `## Vault rules (the docs vault's AGENTS.md)\n\n${vaultRules}`, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createDocTools({ root: deps.docsRoot, exclude: deps.docsExclude }),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: run.repos.map((repo) => repo.name) }),
      ...skills.tools,
      ...createTechWriterTools(deps, run.draft),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    // The draft has to leave draft/: a run that writes no note didn't do the job.
    hasRequiredOutput: () => run.draft.edits.length > 0,
  };
}

// The project's repo from its index note, plus the PBI's repos for a draft adoa captured.
async function draftRepos(context: TaskContext, task: ItemRow, data: DraftTaskData): Promise<RepoRef[]> {
  const projectRepo = await projectRepoName(context.deps.docsRoot, data.project);
  const fromProject = projectRepo ? (await reposByName(context.deps.db, [projectRepo])).repos : [];
  const fromPbi = task.pbiId === null ? [] : (await resolveRepos(context.deps.db, task.pbiId)).repos;
  const byName = new Map([...fromProject, ...fromPbi].map((repo) => [repo.name, repo]));

  return [...byName.values()];
}

async function buildFirstMessage(context: TaskContext, task: ItemRow, data: DraftTaskData, repos: RepoRef[]): Promise<string> {
  const { docsRoot } = context.deps;
  const draftText = await readFile(join(docsRoot, data.path), "utf8");
  const index = await readFile(join(docsRoot, data.project, `${data.project}-index.md`), "utf8").catch(() => "(no project index)");

  return [
    "Move this draft into the docs vault: verify it, merge it into its target, then the draft is deleted.",
    `<task>\nId: ${task.id}\nDraft: ${data.path}\nProject: ${data.project}\nTarget: ${data.target}\nSource: ${data.source}${task.pbiId ? `\nPBI: ${task.pbiId}` : ""}\n</task>`,
    `<draft>\n${draftText.trim()}\n</draft>`,
    `<project-index>\n${index.trim()}\n</project-index>`,
    `<repos>\n${repos.map((repo) => `- ${repo.name} (branch ${repo.defaultBranch})`).join("\n") || "none: the project index names no repo in the catalog"}\n</repos>`,
  ].join("\n\n");
}
