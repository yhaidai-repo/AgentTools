import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPbiContext, relatedBlock, type Command } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool } from "@agenttools/runtime";
import { splitNotesSection } from "@powerloom/vault";
import { z } from "zod";
import { agentCommandContext, createCommandTool } from "../commandTool";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInput } from "../models/AgentRunInput";
import { withPbiContext } from "./withPbiContext";

const DEPS = { db: {} as PowerLoomDb, vaultRoot: "" } as AgentDeps;

function input(firstMessage: string, toolNames: string[]): AgentRunInput {
  const tools = toolNames.map((name) => defineTool({ name, description: name, input: {}, handler: async () => ({ text: "" }) }));

  return { capabilities: {} as AgentRunInput["capabilities"], systemPrompt: "", firstMessage, tools, limits: {} as AgentRunInput["limits"], perRunBudgetUsd: 1, hasRequiredOutput: () => true };
}

describe("splitNotesSection", () => {
  it("cuts the generated note from the user's notes", () => {
    const note = "# PBI-1\n\nDescription.\n\n## Notes\n\nCall Anna first.\n";

    assert.deepEqual(splitNotesSection(note), { generated: "# PBI-1\n\nDescription.", userNotes: "Call Anna first." });
  });

  it("has no user notes when the heading is missing or empty", () => {
    assert.equal(splitNotesSection("# PBI-1\n").userNotes, "");
    assert.equal(splitNotesSection("# PBI-1\n\n## Notes\n").userNotes, "");
  });
});

describe("relatedBlock", () => {
  it("lists each reference with its kind and status, and the repos", () => {
    const block = relatedBlock([{ ref: "PBI-7:design", kind: "design", status: "v2", title: "Add a column" }], ["Repos: PVS (user-confirmed)"]);

    assert.equal(block, "<pbi-related>\nEverything else this PBI has. Read any of it in full by its ref (agents: read_pbi; Claude chats: the pbi.read command).\n- PBI-7:design (design, v2): Add a column\nRepos: PVS (user-confirmed)\n</pbi-related>");
  });

  it("says none when nothing is related", () => {
    assert.match(relatedBlock([], []), /\nnone\n/);
  });
});

describe("withPbiContext", () => {
  it("leaves a run without a PBI as it was", async () => {
    const original = input("Do it.", ["read_file"]);

    assert.equal(await withPbiContext(DEPS, null, original), original);
  });

  it("adds the reading tools a PBI run lacks and keeps a context the executor wrote", async () => {
    const result = await withPbiContext(DEPS, 7, input("Refine this PBI.\n\n<pbi>\nADO id: 7\n</pbi>", ["read_attachment"]));

    assert.ok(hasPbiContext(result.firstMessage));
    assert.equal(result.firstMessage, "Refine this PBI.\n\n<pbi>\nADO id: 7\n</pbi>");
    assert.deepEqual(result.tools.map((tool) => tool.name), ["read_attachment", "read_pbi"]);
  });
});

describe("createCommandTool", () => {
  const echo: Command<{ ref: string }, { ref: string; text: string }> = {
    name: "test.echo",
    description: "Echoes the ref.",
    input: z.object({ ref: z.string().min(1) }),
    run: async (_context, input) => (input.ref === "missing" ? { ok: false, error: "Nothing found for missing." } : { ok: true, value: { ref: input.ref, text: `read ${input.ref}` } }),
  };
  const tool = createCommandTool("read_echo", echo, agentCommandContext({} as PowerLoomDb, "/vault"));

  it("takes the command's description and input, and answers with its text", async () => {
    assert.equal(tool.description, "Echoes the ref.");
    assert.deepEqual(Object.keys(tool.input), ["ref"]);
    assert.deepEqual(await tool.handler({ ref: "PBI-7" }), { text: "read PBI-7" });
  });

  it("reports an expected failure and invalid input as tool errors", async () => {
    assert.deepEqual(await tool.handler({ ref: "missing" }), { text: "Nothing found for missing.", isError: true });
    assert.equal((await tool.handler({ ref: "" })).isError, true);
  });
});
