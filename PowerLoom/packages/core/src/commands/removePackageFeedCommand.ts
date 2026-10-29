import { z } from "zod";
import type { Command } from "../models/Command";
import type { PackageFeedView } from "../models/PackageFeedView";
import { removePackageFeed } from "../packageFeeds";
import { vaultInput } from "./inputs";

// Dropping a feed drops its token too, which PowerLoom cannot give back.
export const removePackageFeedCommand: Command<{ vault: string; url: string }, PackageFeedView[]> = {
  name: "sandbox.removePackageFeed",
  effect: "destructive",
  description: "Remove a private package feed of the vault, with its saved token: the next restores no longer sign in to the sources under its URL. Confirm with the user naming the URL first (settings_get lists the feeds). Answers the feeds left, without their tokens.",
  input: z.object({ vault: vaultInput, url: z.string().trim().min(1).describe("The feed's URL, as settings_get lists it") }),
  async run(context, input) {
    const left = await removePackageFeed(context.db, input.vault, input.url);

    if (!left) {
      return { ok: false, error: `No package feed ${input.url} in ${input.vault} (settings_get lists them).` };
    }

    return { ok: true, value: left };
  },
};
