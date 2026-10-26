import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { createWwwRecordCommand } from "./createWwwRecordCommand";
import { deleteAgentCommand } from "./deleteAgentCommand";

const record = { vault: "work", source: "chat:test", title: "Stale note", kind: "notice" as const, project: "pos", planned: "Notes stay current", happened: "A note was stale", fault: "Agent" as const, rootCause: null, resolution: null, preventiveAction: null, assumptions: null };

// PowerLoom's own tables are written through its API only (user decision 2026-10-26): the commands hand the write over.
describe("commands that write PowerLoom's own tables", () => {
  it("create a WWW record through PowerLoom and pass its refusal on", async () => {
    const sent: unknown[] = [];
    const answers = [{ ok: true, value: 41 }, { ok: false, error: "No vault work" }];
    const context = { powerloom: { createWwwRecord: async (input: unknown) => (sent.push(input), answers.shift()) } } as unknown as CommandContext;

    const created = await createWwwRecordCommand.run(context, record);
    const refused = await createWwwRecordCommand.run(context, record);

    assert.deepEqual(created, { ok: true, value: { id: 41 } });
    assert.deepEqual(refused, { ok: false, error: "No vault work" });
    assert.deepEqual(sent[0], record);
  });

  it("remove a deleted agent's prompt history through PowerLoom, and say when that failed", async () => {
    const removed: string[] = [];
    const agents = { get: async (id: string) => ({ id, label: "Helper", origin: "user" }), remove: async (id: string) => void removed.push(id) };
    const context = { agents, powerloom: { deletePromptVersions: async () => ({ ok: false, error: "PowerLoom is down" }) } } as unknown as CommandContext;

    const deleted = await deleteAgentCommand.run(context, { id: "helper" });

    assert.deepEqual(removed, ["helper"]);
    assert.deepEqual(deleted, { ok: false, error: "Helper is deleted, but its prompt history wasn't: PowerLoom is down" });
  });
});
