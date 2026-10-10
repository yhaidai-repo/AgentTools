import { runCommand, type ChatTarget, type CloseItemRequest, type Command, type CommandContext, type ItemStatus, type Outcome, type PowerLoomPort, type ReportBugInput } from "@adoa/core";
import { getDb } from "./db";
import { bossJobPort } from "./jobPort";
import { powerloom } from "./powerloom";
import { loadSkillCatalog } from "./skills";

// Every web action runs its change as a command (user decision 2026-10-05), so the web, and later an MCP server, share
// one contract per change. This is the web's side: the person at the browser, pg-boss, its read-only vault mount.
export function runWebCommand<I, O>(command: Command<I, O>, input: unknown): Promise<Outcome<O>> {
  return runCommand(command, webCommandContext(), input);
}

export function webCommandContext(): CommandContext {
  return {
    db: getDb(),
    actor: "human",
    jobs: bossJobPort,
    powerloom: powerloomPort,
    skills: { names: async () => (await loadSkillCatalog()).skills.map((skill) => skill.name) },
  };
}

// PowerLoom answers 202 when the record is queued; anything else is an unexpected failure of the change.
const powerloomPort: PowerLoomPort = {
  async addRecord(kind, sourceId) {
    const { response, error } = await powerloom.POST("/api/records", { body: { kind, sourceId } });

    if (!response.ok) {
      throw new Error(`PowerLoom didn't take the ${kind} record ${sourceId}: ${(error as { detail?: string } | undefined)?.detail ?? response.status}`);
    }
  },
  async openChat(target) {
    const { data, error, response } = await powerloom.POST("/api/chats", { body: chatRequest(target) });

    return data ? { ok: true, value: { url: data.url } } : { ok: false, error: (error as { detail?: string } | undefined)?.detail ?? `PowerLoom answered ${response.status}.` };
  },
  async deletePbi(adoId) {
    const { data, error, response } = await powerloom.DELETE("/api/pbis", { body: { adoIds: [adoId] } });

    if (!data) {
      return { ok: false, error: (error as { detail?: string } | undefined)?.detail ?? `PowerLoom answered ${response.status}.` };
    }

    return data.refused.length === 0 ? { ok: true, value: data.deleted[0]?.title ?? "" } : { ok: false, error: data.refused[0] };
  },
  async closeItem(request: CloseItemRequest, dryRun = false) {
    const { data, error, response } = await powerloom.POST("/api/items/{id}/close", {
      params: { path: { id: request.itemId } },
      body: { adoId: request.adoId, decision: request.decision, resolution: request.resolution, hasAttachment: request.hasAttachment, dryRun },
    });

    return data ? { ok: true, value: { status: data.status as ItemStatus } } : failure(error, response);
  },
  async rerunTask(adoId, itemId) {
    const { data, error, response } = await powerloom.POST("/api/tasks/rerun", { body: { tasks: [{ adoId, itemId }] } });

    if (!data) {
      return failure(error, response);
    }

    return data.reopened.length === 1 ? { ok: true, value: data.reopened[0] } : { ok: false, error: data.refused[0] ?? "Not reopened." };
  },
  async deleteItem(adoId, itemId) {
    const { data, error, response } = await powerloom.DELETE("/api/items/{id}", { params: { path: { id: itemId } }, body: { adoId } });

    return data ? { ok: true, value: data.itemId } : failure(error, response);
  },
  async reportBug(input: ReportBugInput, actor: string) {
    const { data, error, response } = await powerloom.POST("/api/bugs", { body: { parent: input.parent, title: input.title, descriptionMd: input.descriptionMd, priority: input.priority, actor } });

    return data ? { ok: true, value: data } : failure(error, response);
  },
};

// An expected refusal comes back as ProblemDetails; its detail is the message.
function failure(error: unknown, response: Response): { ok: false; error: string } {
  return { ok: false, error: (error as { detail?: string } | undefined)?.detail ?? `PowerLoom answered ${response.status}.` };
}

function chatRequest(target: ChatTarget): { kind: "pbi" | "item" | "review" | "vault"; id: string } {
  switch (target.kind) {
    case "pbi":
      return { kind: "pbi", id: String(target.adoId) };
    case "item":
      return { kind: "item", id: target.itemId };
    case "review":
      return { kind: "review", id: String(target.prId) };
    case "vault":
      return { kind: "vault", id: target.vault };
  }
}
