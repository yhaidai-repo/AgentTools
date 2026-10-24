import { z } from "zod";
import type { Command } from "../models/Command";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// "Load from Confluence" for a linked page whose content is missing: PowerLoom holds the token, so it fetches the page.
export const loadConfluencePageCommand: Command<{ adoId: number; url: string }, { message: string }> = {
  name: "pbi.confluenceLoad",
  description: "Fetch a linked Confluence page's content into the PBI now (PowerLoom holds the token) and close the task asking for it; a failure becomes, or stays, that task with the reason.",
  input: z.object({ adoId: pbiIdInput, url: z.string().trim().min(1).describe("The page's link, as the PBI lists it") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.loadConfluencePage(input.adoId, input.url), () => ({ message: "Loading from Confluence; the PBI shows the page in a few seconds." }));
  },
};
