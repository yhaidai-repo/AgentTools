import type { DraftOutcome } from "./DraftOutcome";
import type { NewWwwRecord } from "./NewWwwRecord";
import type { Outcome } from "./Outcome";
import type { RecordClosingInput } from "./RecordClosingInput";
import type { RegisterRecordInput } from "./RegisterRecordInput";
import type { VaultDraftInput } from "./VaultDraftInput";

// A chat's vault writes without file access (stage 5 of the powerloom-mcp design): PowerLoom writes them at once.
export interface CaptureWorkPort {
  captureDraft(vault: string, draft: VaultDraftInput): Promise<Outcome<DraftOutcome>>;
  // The new record's id (e.g. OQ-007).
  addRegisterRecord(vault: string, record: RegisterRecordInput): Promise<Outcome<string>>;
  closeRegisterRecord(vault: string, closing: RecordClosingInput): Promise<Outcome<{ path: string; id: string; status: string }>>;
  // A What-went-wrong record, stored and appended to the vault's www-log.md; the stored record's id.
  createWwwRecord(record: NewWwwRecord): Promise<Outcome<number>>;
}
