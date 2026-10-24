import { z } from "zod";
import type { Command } from "../models/Command";
import type { ConfluenceLink } from "../models/ConfluenceLink";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The PBI page's "Add Confluence page": a link with why, not fetched; later agents get it.
export const addConfluenceLinkCommand: Command<{ adoId: number; url: string; why: string | null }, { links: ConfluenceLink[] }> = {
  name: "pbi.confluenceLink.add",
  description: "Link a Confluence page to a PBI with why it matters: listed for the PBI's later agents, opened by agents with the Confluence tools; not fetched. A page already linked keeps its entry. Ask the user for the page's link and why, if they didn't say.",
  input: z.object({
    adoId: pbiIdInput,
    url: z.string().trim().url().describe("The Confluence page's link"),
    why: z.string().trim().min(1).nullable().default(null).describe("Why the agents should read it"),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.addConfluenceLink(input.adoId, input.url, input.why), (links) => ({ links }));
  },
};
