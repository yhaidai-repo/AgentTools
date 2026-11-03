import { z } from "zod";
import type { Command } from "../models/Command";
import type { Flow } from "../models/Flow";
import { readFlows } from "../flows";
import { vaultInput } from "./inputs";

const input = z.object({ vault: vaultInput });

export const listFlowsCommand: Command<{ vault: string }, Flow[]> = {
  name: "flow.list",
  effect: "read",
  description: "List a vault's flows as the Flow app shows them: id, name, version, the nodes and edges of each, last changed first. Pass an id to flow_get for one.",
  input,
  async run(context, input) {
    return { ok: true, value: await readFlows(context.db, input.vault) };
  },
};
