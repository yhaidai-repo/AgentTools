import { runCommand, type Command, type CommandContext, type Outcome } from "@powerloom/core";
import { createPowerLoomPort, powerloomFailure } from "@powerloom/client";
import type { UploadedFile } from "@powerloom/attachments";
import { backlogMount } from "./backlogMount";
import { getDb } from "./db";
import { powerloom } from "./powerloom";
import { loadSkillCatalog } from "./skills";

// Every web action runs its change as a command (user decision 2026-10-05), so the web, the CLI and the MCP server
// share one contract per change. This is the web's side: the person at the browser, PowerLoom, the skill folders.
export function runWebCommand<I, O>(command: Command<I, O>, input: unknown): Promise<Outcome<O>> {
  return runCommand(command, webCommandContext(), input);
}

const powerloomPort = createPowerLoomPort(powerloom);

export function webCommandContext(): CommandContext {
  return {
    db: getDb(),
    actor: "human",
    powerloom: powerloomPort,
    skills: { names: async () => (await loadSkillCatalog()).skills.map((skill) => skill.name) },
    backlogMount: backlogMount(),
  };
}

// Uploads for a PBI (several at once; none is stored when one can't be used), optionally for the item they answer and
// the linked document they replace. The refs (ATT-nnn) of the stored files.
export async function uploadAttachments(adoId: number, files: UploadedFile[], target: { itemId: string | null; sourceUrl: string | null }): Promise<Outcome<string[]>> {
  const form = new FormData();

  files.forEach((file) => form.append("files", new Blob([new Uint8Array(file.bytes)], { type: file.contentType || "application/octet-stream" }), file.fileName));

  if (target.itemId) {
    form.append("itemId", target.itemId);
  }

  if (target.sourceUrl) {
    form.append("sourceUrl", target.sourceUrl);
  }

  const { data, error, response } = await powerloom.POST("/api/pbis/{adoId}/attachments", { params: { path: { adoId } }, body: form as never, bodySerializer: (body) => body as unknown as FormData });

  return data ? { ok: true, value: data.refs } : powerloomFailure(error, response);
}
