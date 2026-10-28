import type { HunkLine } from "../models/HunkLine";
import type { Outcome } from "../models/Outcome";
import type { PatchHunk } from "../models/PatchHunk";
import type { PatchOperation } from "../models/PatchOperation";

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const ADD = "*** Add File: ";
const DELETE = "*** Delete File: ";
const UPDATE = "*** Update File: ";
const MOVE = "*** Move to: ";
const END_OF_FILE = "*** End of File";
const HUNK = "@@";
const MARKERS: Record<string, HunkLine["kind"]> = { " ": "context", "-": "remove", "+": "add" };

// Codex's apply_patch format (the `*** Begin Patch` envelope with Add / Delete / Update File sections), so a model
// trained on it edits the sandbox the way it edits its own workspace.
export class PatchParser {
  private index = 0;
  private readonly lines: string[];

  private constructor(text: string) {
    this.lines = text.replace(/\r\n/g, "\n").split("\n");
  }

  static parse(text: string): Outcome<PatchOperation[]> {
    return new PatchParser(text.trim()).operations();
  }

  private operations(): Outcome<PatchOperation[]> {
    if (this.lines[0]?.trim() !== BEGIN) {
      return this.fail(`the patch must start with "${BEGIN}"`);
    }

    this.index = 1;

    const operations: PatchOperation[] = [];

    while (this.index < this.lines.length && this.current().trim() !== END) {
      const operation = this.operation();

      if (!operation.ok) {
        return operation;
      }

      operations.push(operation.value);
    }

    if (this.index >= this.lines.length) {
      return this.fail(`the patch must end with "${END}"`);
    }

    return operations.length > 0 ? { ok: true, value: operations } : this.fail("the patch changes no file");
  }

  private operation(): Outcome<PatchOperation> {
    const header = this.current();

    if (header.startsWith(ADD)) {
      return this.addFile(header.slice(ADD.length).trim());
    }

    if (header.startsWith(DELETE)) {
      this.index++;

      return { ok: true, value: { kind: "delete", path: header.slice(DELETE.length).trim() } };
    }

    if (header.startsWith(UPDATE)) {
      return this.updateFile(header.slice(UPDATE.length).trim());
    }

    return this.fail(`expected "${ADD}", "${DELETE}" or "${UPDATE}", got "${header}"`);
  }

  private addFile(path: string): Outcome<PatchOperation> {
    const lines: string[] = [];

    this.index++;

    while (this.isBodyLine() && this.current().startsWith("+")) {
      lines.push(this.current().slice(1));
      this.index++;
    }

    if (this.isBodyLine()) {
      return this.fail(`every line of an added file starts with "+" (${path})`);
    }

    return { ok: true, value: { kind: "add", path, lines } };
  }

  private updateFile(path: string): Outcome<PatchOperation> {
    this.index++;

    const moveTo = this.current().startsWith(MOVE) ? this.current().slice(MOVE.length).trim() : null;

    if (moveTo !== null) {
      this.index++;
    }

    const hunks: PatchHunk[] = [];

    while (this.isBodyLine()) {
      const hunk = this.hunk(hunks.length === 0);

      if (!hunk.ok) {
        return hunk;
      }

      hunks.push(hunk.value);
    }

    if (hunks.length === 0 && moveTo === null) {
      return this.fail(`the update of ${path} has no @@ hunk`);
    }

    return { ok: true, value: { kind: "update", path, moveTo, hunks } };
  }

  // The first hunk may leave out its `@@` line.
  private hunk(isFirst: boolean): Outcome<PatchHunk> {
    const hunk: PatchHunk = { anchor: null, lines: [], atEnd: false };

    if (this.current().startsWith(HUNK)) {
      hunk.anchor = this.current().slice(HUNK.length).trim() || null;
      this.index++;
    } else if (!isFirst) {
      return this.fail(`expected "@@", got "${this.current()}"`);
    }

    while (this.isBodyLine() && !this.current().startsWith(HUNK)) {
      const line = this.hunkLine(hunk);

      if (!line.ok) {
        return line;
      }
    }

    return { ok: true, value: hunk };
  }

  private hunkLine(hunk: PatchHunk): Outcome<null> {
    const line = this.current();

    this.index++;

    if (line === END_OF_FILE) {
      hunk.atEnd = true;

      return { ok: true, value: null };
    }

    // A blank line is a blank context line: models often drop the leading space.
    const kind = MARKERS[line.length === 0 ? " " : line[0]];

    if (!kind) {
      this.index--;

      return this.fail(`a hunk line starts with " ", "-" or "+", got "${line}"`);
    }

    hunk.lines.push({ kind, text: line.slice(1) });

    return { ok: true, value: null };
  }

  private isBodyLine(): boolean {
    if (this.index >= this.lines.length) {
      return false;
    }

    return this.current() === END_OF_FILE || !this.current().startsWith("*** ");
  }

  private current(): string {
    return this.lines[this.index] ?? "";
  }

  private fail<T>(reason: string): Outcome<T> {
    return { ok: false, reason: `Patch line ${this.index + 1}: ${reason}.` };
  }
}
