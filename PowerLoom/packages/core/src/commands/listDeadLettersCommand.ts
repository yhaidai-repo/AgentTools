import { z } from "zod";
import type { Command } from "../models/Command";
import type { DeadLetter } from "../models/DeadLetter";
import { fixedPeriodStart, periodStart } from "../periods";
import { periodInput, vaultInput } from "./inputs";

const input = z.object({
  period: periodInput,
  vault: vaultInput.optional().describe("Only needed for the sprint period (the vault's current sprint); dead letters belong to the whole PowerLoom"),
});

type DeadLettersInput = z.infer<typeof input>;

// The Agents overview's dead letters: what PowerLoom gave up on in the period, read from PowerLoom over its API.
export const listDeadLettersCommand: Command<DeadLettersInput, DeadLetter[]> = {
  name: "deadletter.list",
  effect: "read",
  description: "List the messages PowerLoom gave up on after its retries (dead letters) sent in the period: message type, exception, when, source and whether a replay is under way. They belong to the whole PowerLoom, not a vault.",
  input,
  async run(context, input) {
    const since = input.vault ? await periodStart(context.db, input.period, input.vault) : fixedPeriodStart(input.period, new Date());

    return context.powerloom.deadLetters(since);
  },
};
