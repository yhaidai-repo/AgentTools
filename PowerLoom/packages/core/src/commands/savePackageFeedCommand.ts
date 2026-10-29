import { z } from "zod";
import type { Command } from "../models/Command";
import type { PackageFeedView } from "../models/PackageFeedView";
import { feedUrlInput, savePackageFeed } from "../packageFeeds";
import { vaultInput } from "./inputs";

// A private package feed of the vault (vault setting `packageFeeds`): its restores sign in to the sources under the
// URL with the token, and its hosts join the package hosts. The token is stored, never answered.
export const savePackageFeedCommand: Command<{ vault: string; url: string; username: string; token: string }, PackageFeedView[]> = {
  name: "sandbox.savePackageFeed",
  description: "Add or replace a private package feed of the vault (private feeds of other organizations, or with a token of their own; the vault's own Azure DevOps feeds need none): restores sign in to every source of the repo's nuget.config or .npmrc under the URL with the token, during restores only, and the feed's hosts join the package hosts. The feed is matched by its URL; an empty token keeps the saved one. Ask the user for the URL, the user name (optional) and the token they didn't give; show the URL and user name, never the token, and save after their yes. Answers the feeds without their tokens.",
  input: z.object({
    vault: vaultInput,
    url: feedUrlInput,
    username: z.string().trim().max(200).default("").describe("The user name the feed expects; Azure Artifacts takes any (empty: PowerLoom's default)"),
    token: z.string().trim().max(2000).default("").describe("A personal access token with read rights on the feed's packages; empty keeps the saved one"),
  }),
  async run(context, input) {
    return savePackageFeed(context.db, input.vault, { url: input.url, username: input.username, token: input.token });
  },
};
