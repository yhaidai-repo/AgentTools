// The worktree's folder as the run's shell names it, turned into the repo's folder in the sandbox: a routed command
// runs from the same place in the copy, and the absolute paths it names point into the copy. A Windows folder is
// matched case-insensitively, with either slash.
const WINDOWS_FOLDER = /^[a-z]:\//i;
// The rest of a path after the worktree's folder: up to a space, a quote or a shell separator.
const PATH_REST = /([^\s"';|&]*)/;

/** The sandbox folder for the shell's folder `cwd`; the repo's root when `cwd` is not inside the worktree. */
export function sandboxFolderOf(worktree: string, cwd: string, repoFolder: string): string {
  const root = rootOf(worktree);
  const folder = withSlashes(cwd);
  const inside = isWindowsFolder(root) ? folder.toLowerCase().startsWith(`${root.toLowerCase()}/`) : folder.startsWith(`${root}/`);

  return inside ? `${repoFolder}/${folder.slice(root.length + 1)}`.replace(/\/+$/, "") : repoFolder;
}

/** `command` with each spelling of the worktree's folder (either slash, Git Bash's /d/…) replaced by the repo's folder,
 *  and the rest of each such path given forward slashes. */
export function withSandboxPaths(command: string, worktree: string, repoFolder: string): string {
  const root = rootOf(worktree);
  const flags = isWindowsFolder(root) ? "gi" : "g";
  const inCopy = (_: string, rest: string) => `${repoFolder}${withSlashes(rest)}`;

  return spellingsOf(root).reduce((text, spelling) => text.replace(new RegExp(`${escaped(spelling)}${PATH_REST.source}`, flags), inCopy), command);
}

function spellingsOf(root: string): string[] {
  if (!isWindowsFolder(root)) {
    return [root];
  }

  const gitBash = root.replace(/^([a-z]):/i, (_, drive: string) => `/${drive.toLowerCase()}`);

  return [root.replace(/\//g, "\\"), root, gitBash];
}

function rootOf(worktree: string): string {
  return withSlashes(worktree).replace(/\/+$/, "");
}

function isWindowsFolder(path: string): boolean {
  return WINDOWS_FOLDER.test(path);
}

function withSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
