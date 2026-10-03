import type { DiffFile } from "./models/DiffFile";
import type { DiffScope } from "./models/DiffScope";

const FILE_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
// Generated or binary content nobody reviews line by line.
const NOT_REVIEWED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|packages\.lock\.json)$|\.min\.(js|css)$/i;

// git's unified diff split per file, with the file's status and line counts.
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const sections = diff.split(/^(?=diff --git )/m).filter((section) => section.startsWith("diff --git "));

  return sections.map(parseSection);
}

// Largest changes first until maxLines changed lines (user decision 2026-10-02); lock files, minified and binary files
// are never reviewed. Everything left out is listed with why, so the agent can say what it didn't review.
export function selectScope(files: DiffFile[], maxLines: number): DiffScope {
  const reviewable = files.filter((file) => file.status !== "deleted" && file.status !== "binary" && !NOT_REVIEWED.test(file.path));
  const largestFirst = [...reviewable].sort((a, b) => changedLines(b) - changedLines(a));
  const reviewed = takeWithinBudget(largestFirst, maxLines);
  const skipped = files.filter((file) => !reviewed.includes(file)).map((file) => ({ file, reason: skipReason(file, reviewable) }));

  return { reviewed, skipped };
}

// The old-side line ranges a file's diff changed: a comment on any of these lines no longer matches the code.
export function changedOldRanges(patch: string): [number, number][] {
  const hunks = patch.split("\n").map((line) => HUNK_HEADER.exec(line)).filter((match): match is RegExpExecArray => match !== null);

  return hunks.map((match) => {
    const start = Number(match[1]);
    const length = match[2] === undefined ? 1 : Number(match[2]);

    return [start, start + Math.max(length, 1) - 1];
  });
}

export function overlaps(ranges: [number, number][], start: number, end: number): boolean {
  return ranges.some(([from, to]) => from <= end && start <= to);
}

function parseSection(section: string): DiffFile {
  const lines = section.split("\n");
  const [, oldHeaderPath, newHeaderPath] = FILE_HEADER.exec(lines[0]) ?? [];
  const oldPath = pathAfter(lines, "--- a/") ?? oldHeaderPath ?? "";
  const newPath = pathAfter(lines, "+++ b/") ?? newHeaderPath ?? oldPath;
  const status = fileStatus(lines, oldPath, newPath);

  return {
    path: status === "deleted" ? oldPath : newPath,
    oldPath: status === "renamed" ? oldPath : null,
    status,
    added: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    removed: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
    patch: section.trimEnd(),
  };
}

function fileStatus(lines: string[], oldPath: string, newPath: string): DiffFile["status"] {
  if (lines.some((line) => line.startsWith("Binary files "))) {
    return "binary";
  }

  if (lines.some((line) => line === "--- /dev/null")) {
    return "added";
  }

  if (lines.some((line) => line === "+++ /dev/null")) {
    return "deleted";
  }

  return oldPath !== newPath ? "renamed" : "modified";
}

function pathAfter(lines: string[], prefix: string): string | null {
  const line = lines.find((entry) => entry.startsWith(prefix));

  return line ? line.slice(prefix.length) : null;
}

function takeWithinBudget(files: DiffFile[], maxLines: number): DiffFile[] {
  const taken: DiffFile[] = [];
  let used = 0;

  for (const file of files) {
    const fits = used + changedLines(file) <= maxLines || taken.length === 0;

    used += fits ? changedLines(file) : 0;
    taken.push(...(fits ? [file] : []));
  }

  return taken;
}

function skipReason(file: DiffFile, reviewable: DiffFile[]): string {
  if (file.status === "deleted") {
    return "deleted";
  }

  if (!reviewable.includes(file)) {
    return "binary, lock or minified file";
  }

  return "over the changed-lines limit for one run";
}

function changedLines(file: DiffFile): number {
  return file.added + file.removed;
}
