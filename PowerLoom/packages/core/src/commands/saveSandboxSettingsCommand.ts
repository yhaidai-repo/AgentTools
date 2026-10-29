import { z } from "zod";
import type { Command } from "../models/Command";
import type { SandboxSettings } from "../models/SandboxSettings";
import { packageHostsInput, sandboxImageInput, saveSandboxSettings } from "../sandboxSettings";
import { readSandboxSettings } from "../settings";
import { vaultInput } from "./inputs";

// Settings → Data access → Sandbox: the hosts the vault's package restores may reach and the image its sandboxes
// start from. The list replaces the saved one whole, so a chat reads it first (settings_get) and shows the result.
export const saveSandboxSettingsCommand: Command<{ vault: string; packageHosts: string[]; image?: string }, SandboxSettings> = {
  name: "sandbox.saveSettings",
  description: "Set the vault's sandbox settings (Settings → Data access → Sandbox): the package hosts its restores may reach, as the full list that replaces the saved one, and optionally the image. Hosts are names (api.nuget.org), `*.example.com` for every host under it, or a name with `*` inside a label; no scheme, path or port. Trimmed, lower-cased and de-duplicated. The vault's own Azure DevOps feeds and its private feeds' hosts need no entry. Read the saved list with settings_get first, ask the user for what they didn't give, show the resulting list (and the image when it changes) and save after their yes.",
  input: z.object({
    vault: vaultInput,
    packageHosts: packageHostsInput.describe("Every host the restores may reach; replaces the saved list"),
    image: sandboxImageInput.optional().describe("An image name of the catalog; empty for the default; left out keeps the saved one"),
  }),
  async run(context, input) {
    const saved = await readSandboxSettings(context.db, input.vault);
    const settings = { packageHosts: input.packageHosts, image: input.image ?? saved.image };

    await saveSandboxSettings(context.db, input.vault, settings);

    return { ok: true, value: settings };
  },
};
