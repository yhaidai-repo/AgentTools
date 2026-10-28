import { Buffer } from "node:buffer";
import type { ToolDefinition } from "@agenttools/runtime";
import type { FileChange } from "@powerloom/sandbox";
import { z } from "zod";
import type { AgentDeps } from "../models/AgentDeps";
import type { OutsideAccessContext } from "../models/OutsideAccessContext";
import { defineOutsideTool } from "../outsideAccess";
import type { RunSandbox } from "./models/RunSandbox";
import type { SandboxAccess } from "./models/SandboxAccess";
import { failure, noSandbox, resourceOf } from "./sandboxResults";

const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

const PATCH_FORMAT = [
  "*** Begin Patch",
  "*** Update File: repo/src/a.ts",
  "@@ function load() {",
  "   const x = 1;",
  "-  return x;",
  "+  return x + 1;",
  "*** Add File: repo/src/b.ts",
  "+export const b = 2;",
  "*** Delete File: repo/src/old.ts",
  "*** End Patch",
].join("\n");

// The sandbox's file edits, in both shapes the models know: Codex's apply_patch and Claude's Edit, plus a whole-file
// write. Paths are under /workspace (relative ones too); the log keeps which files changed, never their text.
export function createEditTools(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox): ToolDefinition<any>[] {
  return [applyPatchTool(deps, context, access, sandbox), editFileTool(deps, context, access, sandbox), writeFileTool(deps, context, access, sandbox)];
}

function applyPatchTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "apply_patch",
    description: `Edit files in your sandbox with a patch: add, update (with @@ hunks of context " ", removed "-" and added "+" lines; "*** Move to: path" renames), or delete files. All or nothing: if one hunk doesn't match, nothing is written and the answer names it. Paths are relative to /workspace. Format:\n${PATCH_FORMAT}`,
    input: { input: z.string().min(1).describe("The whole patch, from *** Begin Patch to *** End Patch") },
    resource: () => resourceOf(access, sandbox),
    request: (input) => `patch ${patchFiles(input.input)}`,
    handler: async (input) => {
      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.applyPatch(sandbox.info.id, input.input);

      return answer.ok ? { text: `Done:\n${answer.value.changed.map(changeText).join("\n")}`, rows: answer.value.changed.length } : failure(answer);
    },
  });
}

function editFileTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "edit_file",
    description: "Replace text in a file in your sandbox. old_string must be the file's text exactly as it is now (indentation included) and match once, unless replace_all is set. The file keeps its line endings.",
    input: {
      file_path: z.string().min(1).describe("The file, under /workspace"),
      old_string: z.string().min(1).describe("The text to replace"),
      new_string: z.string().describe("The text to put in its place"),
      replace_all: z.boolean().optional().describe("Replace every match (default false)"),
    },
    resource: () => resourceOf(access, sandbox),
    request: (input) => `edit ${input.file_path}${input.replace_all ? " (all)" : ""}`,
    handler: async (input) => {
      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.edit(sandbox.info.id, { path: input.file_path, oldString: input.old_string, newString: input.new_string, replaceAll: input.replace_all ?? false });

      if (!answer.ok) {
        return failure(answer);
      }

      const [from, to] = answer.value.lines;

      return { text: `Edited ${input.file_path}: ${answer.value.count} replacement${answer.value.count === 1 ? "" : "s"}, the first at lines ${from}-${to}.` };
    },
  });
}

function writeFileTool(deps: AgentDeps, context: OutsideAccessContext, access: SandboxAccess, sandbox: RunSandbox) {
  return defineOutsideTool(deps.outside, context, {
    name: "write_file",
    description: "Write a whole file in your sandbox (a script, a fixture, a new file); it replaces the file if it exists. Use apply_patch or edit_file to change part of a file.",
    input: {
      path: z.string().min(1).describe("The file, under /workspace; missing folders are made"),
      content: z.string().describe("The file's whole text"),
    },
    resource: () => resourceOf(access, sandbox),
    request: (input) => `write ${input.path} (${Buffer.byteLength(input.content, "utf8")} bytes)`,
    handler: async (input) => {
      if (!sandbox.info) {
        return noSandbox();
      }

      const answer = await access.client.writeFile(sandbox.info.id, { path: input.path, content: input.content });

      return answer.ok ? { text: `Wrote ${answer.value.path} (${answer.value.bytes} bytes).` } : failure(answer);
    },
  });
}

function patchFiles(patch: string): string {
  return [...patch.matchAll(PATCH_FILE)].map((match) => match[1].trim()).join(", ") || "(no file)";
}

function changeText(change: FileChange): string {
  return change.op === "move" ? `moved ${change.path} to ${change.movedTo}` : `${change.op} ${change.path}`;
}
