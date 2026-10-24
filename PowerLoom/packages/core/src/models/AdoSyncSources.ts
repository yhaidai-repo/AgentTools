// What a vault's ADO sync pulls: the sprint's PBIs, the import inbox's items, or (null) one PBI by id.
export type AdoSyncSources = "sprint" | "imports" | null;
