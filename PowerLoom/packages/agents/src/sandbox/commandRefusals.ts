// Readable answers for commands that can't work in the sandbox (user decision 2026-10-28: the isolation enforces, this
// list only explains). A command it misses still fails, on the missing network or rights; it is checked per
// pipeline segment, by the segment's first words.
const REFUSALS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^git\s+(push|pull|fetch|clone)\b/, reason: "The sandbox has no network and its repos have no remote: git push, pull, fetch and clone can't work. Commit locally if you need to; your result carries what you found." },
  { pattern: /^(sudo|su|doas)\b/, reason: "Commands run as an ordinary user with no way to gain rights: sudo can't work." },
  { pattern: /^(docker|podman|kubectl)\b/, reason: "There is no container engine in the sandbox." },
  { pattern: /^(apt|apt-get|apk|yum|dnf|brew)\b/, reason: "The image's tools are fixed and the sandbox has no network: packages can't be installed." },
  { pattern: /^(npm|pnpm|yarn)\s+(install|i|add)\s+\S/, reason: "The sandbox has no network: new npm packages can't be installed. Use what the repo already has." },
  { pattern: /^dotnet\s+add\s+\S+\s+package\b|^dotnet\s+add\s+package\b/, reason: "run_command has no network: dotnet add package can't fetch here. Name the package in sandbox_restore's `packages` (the restore adds and fetches it), then add the PackageReference in your own copy." },
  { pattern: /^(pip|pip3)\s+install\b/, reason: "The sandbox has no network: Python packages can't be installed." },
  { pattern: /^(curl|wget|ssh|scp|nc|telnet)\b/, reason: "The sandbox has no network. Read the web with the web tools, if you have them." },
];

const SEGMENT_SPLIT = /&&|\|\||[;|\n]/;

/** Why `command` can't work in the sandbox, or null when nothing in the list says so. */
export function refusalOf(command: string): string | null {
  const segments = command.split(SEGMENT_SPLIT).map((segment) => segment.trim().replace(/^\(+\s*/, ""));

  for (const segment of segments) {
    const refusal = REFUSALS.find((entry) => entry.pattern.test(segment));

    if (refusal) {
      return refusal.reason;
    }
  }

  return null;
}
