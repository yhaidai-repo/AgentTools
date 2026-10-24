import { z } from "zod";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// Settings → Sync → Cleanup's "Run now": with the saved settings; the report lands on the dashboard's Application tab.
export const runCleanupCommand: Command<{ vault: string }, { message: string }> = {
  name: "cleanup.run",
  effect: "destructive",
  description: "Run the vault's cleanup now with its saved settings: closed PBIs, trash, failed imports, old run events and browser artefacts past their buffers (in dry run it only reports; settings.get shows which). Confirm with the user first, saying whether it deletes or only reports.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.runCleanup(input.vault), () => ({ message: "Cleanup started; its report shows on the dashboard's Application tab." }));
  },
};
