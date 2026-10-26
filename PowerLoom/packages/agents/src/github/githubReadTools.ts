import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import { defineOutsideTool } from "../outsideAccess";
import { GitHubApiError } from "./GitHubApiError";
import { gitHubRepoNamed } from "./githubRepos";
import { checksText, issueListText, issueText, pullListText, pullText } from "./githubText";
import type { GitHubRepoTarget } from "./models/GitHubRepoTarget";

export const GITHUB_READ_INTEGRATION = "githubRead";

const repoInput = z.string().trim().min(1).describe("A GitHub repo of the vault by its name, as list_repos shows it");
const stateInput = z.enum(["open", "closed", "all"]).default("open");
const numberInput = z.number().int().positive();

// GitHub (read) (user decision 2026-10-25): an agent with the switch reads the vault's GitHub repos' pull requests,
// issues and CI checks through GitHub's API (the code itself is Read repositories). Every call goes to the data access
// log; a refused token asks the user to fix it.
export function createGitHubReadTools(deps: AgentDeps, agent: AgentDefinition, context: OutsideAccessContext): ToolDefinition<any>[] {
  const github = deps.github;

  if (agent.capabilities.integrations?.[GITHUB_READ_INTEGRATION] !== true || !github) {
    return [];
  }

  const call = (repo: string, read: (target: GitHubRepoTarget) => Promise<string>) => onRepo(deps, context, repo, read);

  return [
    defineOutsideTool(deps.outside, context, {
      name: "github_pull_requests",
      description: "List a GitHub repo's pull requests, latest updated first (30): number, title, state, author, branches.",
      input: { repo: repoInput, state: stateInput },
      resource: (input) => resourceOf(input.repo, `pulls ${input.state}`),
      request: (input) => `list ${input.state} pull requests`,
      handler: (input) => call(input.repo, async (target) => pullListText(await github.api.pullRequests(target.owner, target.name, input.state))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_pull_request",
      description: "Read one GitHub pull request: description, changed files, reviews, line comments and comments. For its code, read its branch with the repo tools.",
      input: { repo: repoInput, number: numberInput },
      resource: (input) => resourceOf(input.repo, `#${input.number}`),
      request: (input) => `read pull request #${input.number}`,
      handler: (input) => call(input.repo, async (target) => pullText(await github.api.pullRequest(target.owner, target.name, input.number))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_issues",
      description: "List a GitHub repo's issues (30), or search them by words.",
      input: { repo: repoInput, state: stateInput, text: z.string().trim().min(1).optional().describe("Words the issue has; leave out to list the latest") },
      resource: (input) => resourceOf(input.repo, `issues ${input.state}`),
      request: (input) => (input.text ? `search issues: ${input.text}` : `list ${input.state} issues`),
      handler: (input) => call(input.repo, async (target) => issueListText(await github.api.issues(target.owner, target.name, input.state, input.text ?? null))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_issue",
      description: "Read one GitHub issue with its comments.",
      input: { repo: repoInput, number: numberInput },
      resource: (input) => resourceOf(input.repo, `#${input.number}`),
      request: (input) => `read issue #${input.number}`,
      handler: (input) => call(input.repo, async (target) => issueText(await github.api.issue(target.owner, target.name, input.number))),
    }),
    defineOutsideTool(deps.outside, context, {
      name: "github_checks",
      description: "Read the CI checks of a branch or commit on GitHub (check runs and statuses with their conclusions), e.g. a pull request's head branch.",
      input: { repo: repoInput, ref: z.string().trim().min(1).describe("A branch, tag or commit") },
      resource: (input) => resourceOf(input.repo, input.ref),
      request: (input) => `read checks of ${input.ref}`,
      handler: (input) => call(input.repo, async (target) => checksText(input.ref, await github.api.checks(target.owner, target.name, input.ref))),
    }),
  ];
}

export function resourceOf(repo: string, target: string) {
  return { kind: "github" as const, resource: repo, target };
}

/** A call on one of the vault's GitHub repos: an unknown repo is refused, GitHub's refusals are answers. */
export async function onRepo(deps: AgentDeps, context: OutsideAccessContext, repo: string, read: (target: GitHubRepoTarget) => Promise<string>): Promise<OutsideToolResult> {
  const target = await gitHubRepoNamed(deps.db, context.vault, repo);

  if (!target) {
    const refusal = `${repo} isn't an enabled GitHub repo of this vault (list_repos names them).`;

    return { text: refusal, isError: true, refusal };
  }

  return guarded(() => read(target));
}

async function guarded(read: () => Promise<string>): Promise<OutsideToolResult> {
  try {
    return { text: await read() };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { text: error.message, isError: true, denied: error.isDenied };
    }

    throw error;
  }
}
