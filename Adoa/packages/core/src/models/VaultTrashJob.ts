// A file in a vault's `.trash/` (the vault review moves removed notes there): put it back, or delete it for good.
export interface VaultTrashJob {
  vault: string;
  /** Relative to `.trash/`, which is also where the note was in the vault. */
  path: string;
  action: "restore" | "delete";
}
