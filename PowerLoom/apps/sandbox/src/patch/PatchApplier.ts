import type { FileChange } from "@powerloom/sandbox";
import { TextFile } from "../files/TextFile";
import type { FileStore } from "../models/FileStore";
import type { Outcome } from "../models/Outcome";
import type { PatchHunk } from "../models/PatchHunk";
import type { PatchOperation } from "../models/PatchOperation";
import type { PlannedWrite } from "../models/PlannedWrite";
import { seekLines } from "./seekLines";

// Applies a parsed patch all or nothing: every hunk of every file is matched first, and only a patch that fully
// matches writes anything, so a failed patch leaves the workspace as it was.
export class PatchApplier {
  constructor(private readonly files: FileStore) {}

  async apply(operations: PatchOperation[]): Promise<Outcome<FileChange[]>> {
    // What the patch has planned so far: a later section of the same patch sees the earlier ones' result.
    const planned = new Map<string, string | null>();

    for (const operation of operations) {
      const writes = await this.plan(operation, planned);

      if (!writes.ok) {
        return writes;
      }

      writes.value.forEach((write) => planned.set(write.path, write.content));
    }

    await this.write(planned);

    return { ok: true, value: operations.map(changeOf) };
  }

  private async plan(operation: PatchOperation, planned: Map<string, string | null>): Promise<Outcome<PlannedWrite[]>> {
    const current = planned.has(operation.path) ? planned.get(operation.path) ?? null : await this.files.read(operation.path);

    if (operation.kind === "add") {
      return current === null ? { ok: true, value: [{ path: operation.path, content: TextFile.of(operation.lines).toString() }] } : failure(operation.path, "it already exists: use *** Update File");
    }

    if (current === null) {
      return failure(operation.path, "it doesn't exist");
    }

    if (operation.kind === "delete") {
      return { ok: true, value: [{ path: operation.path, content: null }] };
    }

    return planUpdate(operation, current);
  }

  private async write(planned: Map<string, string | null>): Promise<void> {
    for (const [path, content] of planned) {
      await (content === null ? this.files.remove(path) : this.files.write(path, content));
    }
  }
}

function planUpdate(operation: Extract<PatchOperation, { kind: "update" }>, current: string): Outcome<PlannedWrite[]> {
  const updated = applyHunks(TextFile.parse(current), operation.hunks);

  if (!updated.ok) {
    return failure(operation.path, updated.reason);
  }

  if (operation.moveTo === null) {
    return { ok: true, value: [{ path: operation.path, content: updated.value }] };
  }

  return { ok: true, value: [{ path: operation.path, content: null }, { path: operation.moveTo, content: updated.value }] };
}

// Each hunk is searched below the one before it, as in a unified diff.
function applyHunks(file: TextFile, hunks: PatchHunk[]): Outcome<string> {
  const lines = [...file.lines];
  let cursor = 0;

  for (const [index, hunk] of hunks.entries()) {
    const start = hunkStart(lines, hunk, cursor);

    if (start < 0) {
      return { ok: false, reason: `hunk ${index + 1} doesn't match the file${hunk.anchor ? ` below "${hunk.anchor}"` : ""}: its context and "-" lines must be the file's lines as they are now (read the file again)` };
    }

    const replacement = replacementLines(hunk, lines, start);

    lines.splice(start, oldLinesOf(hunk).length, ...replacement);
    cursor = start + replacement.length;
  }

  return { ok: true, value: file.withLines(lines).toString() };
}

// Where the hunk's old lines start, or -1. A hunk that only adds lines goes right below its anchor, or at the end of
// the file without one.
function hunkStart(lines: string[], hunk: PatchHunk, cursor: number): number {
  const from = hunk.anchor === null ? cursor : belowAnchor(lines, hunk.anchor, cursor);
  const oldLines = oldLinesOf(hunk);

  if (from < 0 || oldLines.length > 0) {
    return from < 0 ? -1 : seekLines(lines, oldLines, from, hunk.atEnd);
  }

  return hunk.anchor === null ? lines.length : from;
}

// A context line keeps the file's own text (a loose match may differ in trailing spaces); added lines are the patch's.
function replacementLines(hunk: PatchHunk, lines: string[], start: number): string[] {
  let fileLine = start;

  return hunk.lines.flatMap((line) => {
    if (line.kind === "add") {
      return [line.text];
    }

    fileLine++;

    return line.kind === "context" ? [lines[fileLine - 1]] : [];
  });
}

function oldLinesOf(hunk: PatchHunk): string[] {
  return hunk.lines.filter((line) => line.kind !== "add").map((line) => line.text);
}

function belowAnchor(lines: string[], anchor: string, cursor: number): number {
  const at = seekLines(lines, [anchor], cursor, false);

  return at < 0 ? -1 : at + 1;
}

function changeOf(operation: PatchOperation): FileChange {
  if (operation.kind === "update" && operation.moveTo !== null) {
    return { path: operation.path, op: "move", movedTo: operation.moveTo };
  }

  return { path: operation.path, op: operation.kind };
}

function failure<T>(path: string, reason: string): Outcome<T> {
  return { ok: false, reason: `${path}: ${reason}.` };
}
