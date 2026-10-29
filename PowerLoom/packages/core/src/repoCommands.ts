import type { BuildCommands, PowerLoomDb } from "@powerloom/db";
import { z } from "zod";
import type { RepoCommandSettings } from "./models/RepoCommandSettings";
import { readRepoCommandSettings, saveRepoCommandSettings } from "./settings";

// What the worktree's shell routes to the run's sandbox as one build or test (README, sandbox setup): a single command,
// or `cd <folder> && <command>`. Any other compound is refused at run time, so it is refused when saved.
const SEGMENT_SPLIT = /&&|\|\||[;|\n]/;
const FOLDER_CHANGE = /^cd\s+\S+$/i;
// A substitution runs a hidden command the shell's check doesn't see.
const SUBSTITUTION = /\$\(|`/;
const COMPOUND_PROBLEM = "one command, or `cd <folder> && <command>`: a compound isn't routed to the sandbox";

/** Why a command would not be routed to the sandbox, or null when it is fine; an empty command clears the setting. */
export function repoCommandProblem(command: string): string | null {
  const text = command.trim();

  if (text.length === 0) {
    return null;
  }

  if (SUBSTITUTION.test(text)) {
    return "no command substitution ($(…) or backticks)";
  }

  const segments = text.split(SEGMENT_SPLIT).map((segment) => segment.trim());

  if (segments.length === 1) {
    return null;
  }

  return isFolderThenCommand(text, segments) ? null : COMPOUND_PROBLEM;
}

function isFolderThenCommand(text: string, segments: string[]): boolean {
  return segments.length === 2 && text.includes("&&") && FOLDER_CHANGE.test(segments[0]) && segments[1].length > 0;
}

/** A build or test command as a command's input: one line that the sandbox would route; empty clears it. */
export const repoCommandInput = z.string().trim().max(500).superRefine((value, context) => {
  const problem = repoCommandProblem(value);

  if (problem) {
    context.addIssue({ code: "custom", message: problem });
  }
});

/** A repo's commands by its catalogue name, matched case-insensitively like the repo names agents give. */
export function buildCommandsOf(settings: RepoCommandSettings, repoName: string): BuildCommands {
  const wanted = repoName.toLowerCase();
  const entry = Object.entries(settings.repos).find(([name]) => name.toLowerCase() === wanted)?.[1] ?? {};

  return { build: entry.build || null, test: entry.test || null };
}

/** Saves one repo's build and test commands under its catalogue name; a repo left without any is dropped. */
export async function saveRepoCommands(db: PowerLoomDb, vault: string, repoName: string, commands: BuildCommands): Promise<void> {
  const settings = await readRepoCommandSettings(db, vault);
  const repos = withoutRepo(settings.repos, repoName);
  const kept = keptCommands(commands);

  if (kept) {
    repos[repoName] = kept;
  }

  await saveRepoCommandSettings(db, vault, { repos });
}

// Earlier entries may carry the name in another case; they go, so the repo has one entry.
function withoutRepo(repos: RepoCommandSettings["repos"], repoName: string): RepoCommandSettings["repos"] {
  const dropped = repoName.toLowerCase();

  return Object.fromEntries(Object.entries(repos).filter(([name]) => name.toLowerCase() !== dropped));
}

function keptCommands(commands: BuildCommands): Partial<BuildCommands> | null {
  const kept: Partial<BuildCommands> = {};

  if (commands.build) {
    kept.build = commands.build;
  }

  if (commands.test) {
    kept.test = commands.test;
  }

  return Object.keys(kept).length > 0 ? kept : null;
}
