import { posix, win32, type PlatformPath } from "node:path";
import type { ToolPolicy } from "../../models/ToolPolicy";
import type { ToolPolicyDecision } from "../../models/ToolPolicyDecision";

// Claude Code's tools that write, with the input field naming the file.
const WRITE_FIELDS: Record<string, string> = {
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
};

const SHELL_TOOLS = ["Bash", "PowerShell"];

// Implementation agents commit locally only: pushing and pull requests are a person's step.
const PUBLISHING_COMMANDS: { pattern: RegExp; label: string }[] = [
  { pattern: /(?:^|[\s;&|(`])git(?:\.exe)?(?:\s+(?:-[cC]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+push(?=$|[\s;&|)`])/i, label: "git push" },
  { pattern: /(?:^|[\s;&|(`])gh(?:\.exe)?\s+pr(?=$|[\s;&|)`])/i, label: "gh pr" },
  { pattern: /(?:^|[\s;&|(`])az(?:\.cmd)?\s+repos\s+pr(?=$|[\s;&|)`])/i, label: "az repos pr" },
];

// A word of a shell command that names a path outside a plain relative one: absolute (`/x`, `C:\x`, `\\server\x`), from
// home, or one that climbs (`..`). Plain relative words resolve inside the folder anyway.
const PATH_WORD = /^(?:[a-z]:[\\/]|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/i;
// Home can't be resolved here; it is outside the folder in every setup this runtime runs in.
const HOME_WORD = /^(?:~|\$home\b|\$env:userprofile\b|%userprofile%)/i;
const NULL_DEVICES = ["/dev/null", "nul", "$null"];
const WORD_SEPARATORS = /[\s;&|()<>"'`=,]+/;
// A Git Bash path to a drive (`/d/repo`) on a Windows folder.
const GIT_BASH_DRIVE = /^\/([a-z])(?=\/|$)/i;

// Keeps a run that edits or runs commands inside its folder and away from publishing. Shell commands are checked word
// by word: a path built at run time (a variable, a subshell) is not seen.
export function workspaceGuard(folder: string): ToolPolicy {
  return (call) => {
    const input = (call.input ?? {}) as Record<string, unknown>;

    if (SHELL_TOOLS.includes(call.name)) {
      return checkCommand(folder, call.name, String(input.command ?? ""));
    }

    const target = input[WRITE_FIELDS[call.name] ?? ""];

    if (typeof target !== "string") {
      return { allow: true };
    }

    return isOutside(folder, target) ? outside(call.name, target) : { allow: true };
  };
}

export function isOutside(folder: string, target: string): boolean {
  if (HOME_WORD.test(target)) {
    return true;
  }

  const path = pathModule(folder);
  const relative = path.relative(path.resolve(folder), path.resolve(folder, toFolderStyle(path, target)));

  return relative.split(path.sep)[0] === ".." || path.isAbsolute(relative);
}

function checkCommand(folder: string, toolName: string, command: string): ToolPolicyDecision {
  const publishing = PUBLISHING_COMMANDS.find((entry) => entry.pattern.test(command));

  if (publishing) {
    return { allow: false, reason: `${toolName} was blocked: ${publishing.label} is not allowed; commit locally and leave publishing to a person.` };
  }

  const outsideWord = pathWords(command).find((word) => isOutside(folder, word));

  return outsideWord ? outside(toolName, outsideWord) : { allow: true };
}

function pathWords(command: string): string[] {
  const words = command.split(WORD_SEPARATORS);

  return words.filter((word) => (PATH_WORD.test(word) || HOME_WORD.test(word)) && !NULL_DEVICES.includes(word.toLowerCase()));
}

function toFolderStyle(path: PlatformPath, target: string): string {
  return path === win32 ? target.replace(GIT_BASH_DRIVE, "$1:") : target;
}

// The folder's own style decides, not the host's: a Windows folder is compared case-insensitively with either slash.
function pathModule(folder: string): PlatformPath {
  return /^(?:[a-z]:|\\\\)/i.test(folder) ? win32 : posix;
}

function outside(toolName: string, target: string): ToolPolicyDecision {
  return { allow: false, reason: `${toolName} was blocked: ${target} is outside the run's folder.` };
}
