// One VaultCapture request (fields as the module's CLI takes them, minus vault and source, which the app sets).
export interface CaptureDraft {
  /** Note name: kebab-case, prefixed with the project key, unique in the vault. */
  name: string;
  title: string;
  /** Docs vault project key, e.g. "pvs" or "pvsi". */
  project: string;
  /** Where it belongs once verified: "[[note]]" or a folder. */
  target: string;
  captured: string[];
  assumptions: string[];
  toFill: string[];
}
