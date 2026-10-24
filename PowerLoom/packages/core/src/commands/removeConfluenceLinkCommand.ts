import { z } from "zod";
import type { Command } from "../models/Command";
import type { ConfluenceLink } from "../models/ConfluenceLink";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const removeConfluenceLinkCommand: Command<{ adoId: number; url: string }, { links: ConfluenceLink[] }> = {
  name: "pbi.confluenceLink.remove",
  effect: "destructive",
  description: "Remove a Confluence page link from a PBI; later agents no longer get it. Confirm with the user first, naming the page and the PBI.",
  input: z.object({ adoId: pbiIdInput, url: z.string().trim().min(1).describe("The linked page's link, as pbi.get lists it") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.removeConfluenceLink(input.adoId, input.url), (links) => ({ links }));
  },
};
