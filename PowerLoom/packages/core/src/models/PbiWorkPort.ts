import type { AdoSyncSources } from "./AdoSyncSources";
import type { AttachmentFile } from "./AttachmentFile";
import type { AttachmentTarget } from "./AttachmentTarget";
import type { ConfluenceLink } from "./ConfluenceLink";
import type { Outcome } from "./Outcome";
import type { PreparedPbis } from "./PreparedPbis";

// The PBI changes the web made through the API directly before stage 3 of the powerloom-mcp design (2026-10-24).
export interface PbiWorkPort {
  // Writes the PBIs' notes and queues a refinement task each.
  preparePbis(adoIds: number[]): Promise<Outcome<PreparedPbis>>;
  // Writes the PBIs' notes and queues a design task each, for the planning agent.
  planPbis(adoIds: number[]): Promise<Outcome<PreparedPbis>>;
  // Queues the vault's ADO sync: the sprint, the import inbox, or one PBI (adoId).
  syncAdo(vault: string, adoId: number | null, sources: AdoSyncSources): Promise<Outcome<void>>;
  // The user's own notes: the PBI note's `## Notes` section.
  pbiUserNotes(adoId: number): Promise<Outcome<string>>;
  // `loadedText` is the text the caller read: a stale one is refused, so nobody overwrites a newer note.
  savePbiUserNotes(adoId: number, text: string, loadedText: string): Promise<Outcome<string>>;
  // Stores files on the PBI (none when one can't be used); their refs (ATT-nnn).
  attachToPbi(adoId: number, files: AttachmentFile[], target: AttachmentTarget): Promise<Outcome<string[]>>;
  addConfluenceLink(adoId: number, url: string, why: string | null): Promise<Outcome<ConfluenceLink[]>>;
  removeConfluenceLink(adoId: number, url: string): Promise<Outcome<ConfluenceLink[]>>;
  // Fetches a linked page's content now (PowerLoom holds the token) and closes the task asking for it.
  loadConfluencePage(adoId: number, url: string): Promise<Outcome<void>>;
}
