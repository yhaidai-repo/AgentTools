import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import { contentTypeOf } from "../contentTypeOf";
import { containerPathOf } from "../hostPaths";
import type { AttachmentFile } from "../models/AttachmentFile";
import type { Command } from "../models/Command";
import type { HostFolder } from "../models/HostFolder";
import type { Outcome } from "../models/Outcome";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The PBI page's attachment upload for a chat: a file on the PC, named by its path, read through the container's
// mounts (the vaults root, the repos), so a chat attaches what the user points at without uploading bytes.
export const attachToPbiCommand: Command<{ adoId: number; path: string; itemId: string | null }, { refs: string[] }> = {
  name: "pbi.attach",
  description: "Attach a file to a PBI by its path on this PC (under the vaults folder or the repos folder; anything else is refused): PowerLoom stores it and reads its text for the agents. Optionally as the answer to one of the PBI's items. Ask the user for the file's path; never guess it.",
  input: z.object({
    adoId: pbiIdInput,
    path: z.string().trim().min(1).describe("The file's path on the PC, e.g. D:/Claude/work/specs/export.pdf"),
    itemId: z.string().trim().min(1).nullable().default(null).describe("The item this file answers (e.g. Q-38519-002); null for the PBI"),
  }),
  async run(context, input) {
    const file = await readHostFile(input.path, context.hostFolders ?? []);

    if (!file.ok) {
      return file;
    }

    const stored = await context.powerloom.attachToPbi(input.adoId, [file.value], { itemId: input.itemId, sourceUrl: null });

    return mapOutcome(stored, (refs) => ({ refs }));
  },
};

async function readHostFile(hostPath: string, folders: HostFolder[]): Promise<Outcome<AttachmentFile>> {
  const path = containerPathOf(hostPath, folders);

  if (path === null) {
    return { ok: false, error: `${hostPath} is outside the folders PowerLoom can read (${folders.map((folder) => folder.hostRoot).join(", ") || "none here"}).` };
  }

  try {
    const fileName = basename(path);

    return { ok: true, value: { fileName, contentType: contentTypeOf(fileName), bytes: await readFile(path) } };
  } catch (error) {
    return { ok: false, error: `${hostPath} can't be read: ${(error as Error).message}` };
  }
}
