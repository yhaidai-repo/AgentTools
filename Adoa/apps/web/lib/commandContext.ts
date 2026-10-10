import { runCommand, type ChatTarget, type Command, type CommandContext, type Outcome, type PowerLoomPort } from "@adoa/core";
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
};

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
