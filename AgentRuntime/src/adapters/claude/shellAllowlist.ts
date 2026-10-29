// Builds, tests and scripts run in PowerLoom's sandbox (its run_command tool, and the run's ShellRoute for plain build and
// test commands, asked before this list), never on the runner, which lacks their toolchains: the shell of a run in its
// worktree only commits, runs GSD and lists files. Every segment of a pipeline must be one of these.

// Network and remote subcommands; `push` is also refused on its own with a clearer reason (workspaceGuard).
const DENIED_GIT_SUBCOMMANDS = ["push", "fetch", "pull", "clone", "remote"];
// git options that take the next word as their value.
const GIT_OPTIONS_WITH_VALUE = ["-C", "-c", "--git-dir", "--work-tree", "--namespace"];

const LISTING_COMMANDS = ["ls", "dir", "cat", "type", "find", "rg", "grep", "head", "tail", "wc", "pwd"];

/** The worktree shell's rule in the words the agents are told up front (their worktree shell contract) and every
 *  refusal repeats, so instruction and refusal agree. */
export const WORKTREE_SHELL_RULE = `The worktree's shell runs only git (without ${DENIED_GIT_SUBCOMMANDS.join(", ")}), GSD's node tool and listing commands (${LISTING_COMMANDS.join(", ")}). A plain build or test command (dotnet build, dotnet test, npm test, npm run build, or the repo's configured command), alone or after one \`cd <folder> &&\` and with output filters at most, runs in the sandbox. Everything else is refused: edit files with Edit or Write, and run other scripts with run_command if you have it.`;
const REASON = `is not allowed in the worktree's shell. ${WORKTREE_SHELL_RULE}`;
// A listing command stops being read-only when it writes its output or runs something per file.
const LISTING_WRITES = />>?(?![>&]|\s*(?:\/dev\/null|nul|\$null)(?:\s|$))|\s-(?:exec|execdir|ok|delete|fprint\w*)\b/i;

const GSD_TOOLS = /^node(?:\.exe)?\s+["']?[^"'\s]*gsd-tools\.cjs["']?(?:\s|$)/i;
const GSD_CORE = /^npx(?:\.cmd)?\s+(?:(?:-y|--yes)\s+)?gsd-core(?:\s|$)/i;

// Command substitution runs a hidden command; Claude Code's own commit message form (`"$(cat <<'EOF' … EOF)"`) is the one
// substitution let through.
const SUBSTITUTION = /\$\((?!cat\s+<<)|`/;

// Quoted text is one piece, so a `;` or `|` inside a commit message doesn't split the command.
const PIECES = /"(?:\\.|[^"\\])*"|'[^']*'|&&|\|\||[;|\n]|[^"';|&\n]+|&/g;
const SEPARATORS = ["&&", "||", ";", "|", "\n"];

/** Why a shell command may not run in the worktree, or null when every segment is allowed. */
export function shellRefusal(command: string): string | null {
  const refused = commandSegments(command).find((segment) => !isAllowedSegment(segment));

  return refused === undefined ? null : `${firstWord(refused) || "This command"} ${REASON}`;
}

export function commandSegments(command: string): string[] {
  const segments = [""];

  for (const piece of command.match(PIECES) ?? []) {
    if (SEPARATORS.includes(piece)) {
      segments.push("");
    } else {
      segments[segments.length - 1] += piece;
    }
  }

  return segments.map((segment) => segment.trim().replace(/^\(+\s*/, "").replace(/\)+$/, "").trim()).filter((segment) => segment !== "");
}

function isAllowedSegment(segment: string): boolean {
  if (SUBSTITUTION.test(segment)) {
    return false;
  }

  return isAllowedGit(segment) || GSD_TOOLS.test(segment) || GSD_CORE.test(segment) || isReadOnlyListing(segment);
}

function isAllowedGit(segment: string): boolean {
  const words = segment.split(/\s+/);

  if (!/^git(?:\.exe)?$/i.test(words[0])) {
    return false;
  }

  const subcommand = gitSubcommand(words.slice(1));

  return subcommand !== null && !DENIED_GIT_SUBCOMMANDS.includes(subcommand.toLowerCase());
}

// The first word after git's own options (`git -C . -c a=b commit` → `commit`).
function gitSubcommand(words: string[]): string | null {
  const index = words.findIndex((word, position) => !word.startsWith("-") && !GIT_OPTIONS_WITH_VALUE.includes(words[position - 1]));

  return index === -1 ? null : words[index];
}

function isReadOnlyListing(segment: string): boolean {
  return LISTING_COMMANDS.includes(firstWord(segment).toLowerCase()) && !LISTING_WRITES.test(segment);
}

function firstWord(segment: string): string {
  return segment.split(/\s+/)[0] ?? "";
}
