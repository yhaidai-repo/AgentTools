export interface CaptureDraft {
  title: string;
  /** Docs vault project key, e.g. "pvs" or "pvsi". */
  project: string;
  /** Where it should end up once verified: "[[note]]" or a folder. */
  target: string;
  captured: { fact: string; evidence: string }[];
  toFill: string[];
}
