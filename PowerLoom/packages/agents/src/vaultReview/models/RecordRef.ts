// A register record within one vault: ids repeat across projects (pvs KI-001, pvsi KI-001), so the register path is part of it.
export interface RecordRef {
  /** The register note, relative to the vault root. */
  path: string;
  id: string;
}
