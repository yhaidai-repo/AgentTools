import { Buffer } from "node:buffer";
import type { EditApplied, EditRequest, FileWritten, PatchApplied, WriteFileRequest } from "@powerloom/sandbox";
import { editText } from "../edit/editText";
import type { FileStore } from "../models/FileStore";
import type { Outcome } from "../models/Outcome";
import type { PatchOperation } from "../models/PatchOperation";
import { PatchApplier } from "../patch/PatchApplier";
import { PatchParser } from "../patch/PatchParser";
import { workspacePath } from "./workspacePath";

const MAX_WRITE_BYTES = 1024 * 1024;

// The sandbox's file tools: a patch (Codex's format), a string edit (Claude's Edit) and a whole-file write.
export class FileEditor {
  constructor(private readonly files: FileStore) {}

  async applyPatch(patch: string): Promise<Outcome<PatchApplied>> {
    const parsed = PatchParser.parse(patch);

    if (!parsed.ok) {
      return parsed;
    }

    const operations = inWorkspace(parsed.value);

    if (!operations.ok) {
      return operations;
    }

    const applied = await new PatchApplier(this.files).apply(operations.value);

    return applied.ok ? { ok: true, value: { changed: applied.value } } : applied;
  }

  async edit(request: EditRequest): Promise<Outcome<EditApplied>> {
    const path = workspacePath(request.path);

    if (!path.ok) {
      return path;
    }

    const content = await this.files.read(path.value);

    if (content === null) {
      return { ok: false, reason: `${path.value} doesn't exist: create it with write_file` };
    }

    const edited = editText(content, request.oldString, request.newString, request.replaceAll);

    if (!edited.ok) {
      return { ok: false, reason: `${path.value}: ${edited.reason}` };
    }

    await this.files.write(path.value, edited.value.content);

    return { ok: true, value: edited.value.applied };
  }

  async writeFile(request: WriteFileRequest): Promise<Outcome<FileWritten>> {
    const path = workspacePath(request.path);
    const bytes = Buffer.byteLength(request.content, "utf8");

    if (!path.ok) {
      return path;
    }

    if (bytes > MAX_WRITE_BYTES) {
      return { ok: false, reason: `The content is ${bytes} bytes, more than ${MAX_WRITE_BYTES}: write it in parts or generate it with a command` };
    }

    await this.files.write(path.value, request.content);

    return { ok: true, value: { path: path.value, bytes } };
  }
}

// Every path of the patch as an absolute workspace path; one outside it refuses the whole patch.
function inWorkspace(operations: PatchOperation[]): Outcome<PatchOperation[]> {
  const resolved: PatchOperation[] = [];

  for (const operation of operations) {
    const one = resolvedOperation(operation);

    if (!one.ok) {
      return one;
    }

    resolved.push(one.value);
  }

  return { ok: true, value: resolved };
}

function resolvedOperation(operation: PatchOperation): Outcome<PatchOperation> {
  const path = workspacePath(operation.path);
  const moveTo = operation.kind === "update" && operation.moveTo !== null ? workspacePath(operation.moveTo) : null;

  if (!path.ok) {
    return path;
  }

  if (moveTo && !moveTo.ok) {
    return moveTo;
  }

  if (operation.kind !== "update") {
    return { ok: true, value: { ...operation, path: path.value } };
  }

  return { ok: true, value: { ...operation, path: path.value, moveTo: moveTo ? moveTo.value : null } };
}
