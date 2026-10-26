import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { onRepo, resourceOf } from "./githubReadTools";
import type { GitHubWorkspace } from "./GitHubWorkspace";
import type { GitHubAccess } from "./models/GitHubAccess";
import type { WorkCopy } from "./models/WorkCopy";

export const GITHUB_WRITE_INTEGRATION = "githubWrite";

const repoInput = z.string().trim().min(1).describe("A GitHub repo of the vault by its name, as list_repos shows it");
const pathInput = z.string().trim().min(1).describe("The file's path in the repo, e.g. src/app/Payers.cs");
// A git error that is GitHub refusing the token (no write access, an expired token).
const REFUSED_PUSH = /\b(401|403)\b|Authentication failed|Permission to .* denied|Write access to repository not granted/i;

// GitHub (write) (user decision 2026-10-25): an agent with the switch changes a GitHub repo on a branch of its own
// (powerloom/<task>-r<run>, from the default branch) and hands it over as a draft pull request; it never pushes to any
// other branch, never forces a push and never merges. Every call goes to the data access log.
export function createGitHubWriteTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext, workspace: GitHubWorkspace | null): ToolDefinition<any>[] {
  const github = deps.github;

  if (agent.capabilities.integrations?.[GITHUB_WRITE_INTEGRATION] !== true || !github || !workspace) {
    return [];
  }

  const onCopy = (repo: string, change: (copy: WorkCopy) => Promise<string>) => changeCopy(workspace, repo, change);

  return [
    defineOutsideTool(deps.outside, context, {
      name: "github_start_branch",
      description: `Start this run's branch ${workspace.branch} of a GitHub repo, from its default branch, in a working copy of its own. Call it before changing files; the other github_ write tools work on that copy.`,
      input: { repo: repoInput },
      resource: (input) => resourceOf(input.repo, workspace.branch),
      request: () => `start ${workspace.branch}`,
      handler: (input) => onRepo(deps, context, input.repo, async (target) => startedText(await workspace.start(target))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_write_file",
      description: "Write a whole file in the run's working copy of the repo (creates it, or replaces what it holds). Nothing leaves this PC until github_push.",
      input: { repo: repoInput, path: pathInput, content: z.string().describe("The file's whole new text") },
      resource: (input) => resourceOf(input.repo, input.path),
      request: (input) => `write ${input.path}`,
      handler: (input) => onCopy(input.repo, async (copy) => (await workspace.write(copy, input.path, input.content), `Wrote ${input.path}.`)),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_edit_file",
      description: "Replace one exact piece of a file in the run's working copy: `find` must occur exactly once.",
      input: { repo: repoInput, path: pathInput, find: z.string().min(1).describe("The exact text to replace, with enough around it to be unique"), replace: z.string().describe("Its replacement") },
      resource: (input) => resourceOf(input.repo, input.path),
      request: (input) => `edit ${input.path}`,
      handler: (input) => onCopy(input.repo, (copy) => editFile(workspace, copy, input.path, input.find, input.replace)),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_delete_file",
      description: "Delete a file from the run's working copy of the repo.",
      input: { repo: repoInput, path: pathInput },
      resource: (input) => resourceOf(input.repo, input.path),
      request: (input) => `delete ${input.path}`,
      handler: (input) => onCopy(input.repo, async (copy) => (await workspace.remove(copy, input.path), `Deleted ${input.path}.`)),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_diff",
      description: "Show what changed in the run's working copy since its last commit (new files included).",
      input: { repo: repoInput },
      resource: (input) => resourceOf(input.repo, workspace.branch),
      request: () => "diff",
      handler: (input) => onCopy(input.repo, async (copy) => (await workspace.diff(copy)) || "No changes since the last commit."),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_commit",
      description: "Commit every change of the run's working copy on its branch.",
      input: { repo: repoInput, message: z.string().trim().min(1).describe("The commit message: what changed and why, first line under 72 characters") },
      resource: (input) => resourceOf(input.repo, workspace.branch),
      request: (input) => `commit: ${input.message.split("\n")[0]}`,
      handler: (input) => onCopy(input.repo, async (copy) => committedText(await workspace.commit(copy, input.message), copy)),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_push",
      description: `Push the run's branch (${workspace.branch}) to GitHub. Only this branch is ever pushed, never forced.`,
      input: { repo: repoInput },
      resource: (input) => resourceOf(input.repo, workspace.branch),
      request: () => `push ${workspace.branch}`,
      handler: (input) => pushed(workspace, input.repo),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_open_pull_request",
      description: "Open a draft pull request from the run's pushed branch into the repo's default branch, for a person to review and merge. Push first.",
      input: { repo: repoInput, title: z.string().trim().min(1), body: z.string().describe("What changed, why, and how it was checked; markdown") },
      resource: (input) => resourceOf(input.repo, workspace.branch),
      request: (input) => `open draft pull request: ${input.title}`,
      handler: (input) => onCopy(input.repo, (copy) => openPullRequest(github, copy, input.title, input.body)),
    }),
  ];
}

async function changeCopy(workspace: GitHubWorkspace, repo: string, change: (copy: WorkCopy) => Promise<string>): Promise<OutsideToolResult> {
  const copy = workspace.copyOf(repo);

  if (!copy) {
    const refusal = `Start the branch first: github_start_branch with repo ${repo}.`;

    return { text: refusal, isError: true, refusal };
  }

  try {
    return { text: await change(copy) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { text: message, isError: true, denied: REFUSED_PUSH.test(message) };
  }
}

function pushed(workspace: GitHubWorkspace, repo: string): Promise<OutsideToolResult> {
  return changeCopy(workspace, repo, async (copy) => (await workspace.push(copy), `Pushed ${copy.branch}.`));
}

async function editFile(workspace: GitHubWorkspace, copy: WorkCopy, path: string, find: string, replace: string): Promise<string> {
  const text = await workspace.read(copy, path);
  const count = text.split(find).length - 1;

  if (count !== 1) {
    throw new Error(`${path} has the text ${count} times; give a piece that occurs exactly once.`);
  }

  await workspace.write(copy, path, text.replace(find, () => replace));

  return `Edited ${path}.`;
}

async function openPullRequest(github: GitHubAccess, copy: WorkCopy, title: string, body: string): Promise<string> {
  if (!copy.pushed) {
    throw new Error("Push the branch first: github_push.");
  }

  const pull = await github.api.createDraftPullRequest(copy.target.owner, copy.target.name, { title, body, head: copy.branch, base: copy.base });

  return `Opened draft pull request #${pull.number}: ${pull.html_url}`;
}

function startedText(started: { copy: WorkCopy; baseCommit: string | null }): string {
  const from = started.baseCommit ? `${started.copy.base} (${started.baseCommit.slice(0, 8)})` : started.copy.base;

  return started.baseCommit ? `Started ${started.copy.branch} from ${from}.` : `${started.copy.branch} is started already (from ${from}).`;
}

function committedText(commit: string | null, copy: WorkCopy): string {
  return commit ? `Committed ${commit.slice(0, 8)} on ${copy.branch}.` : "Nothing to commit: the working copy has no changes.";
}
