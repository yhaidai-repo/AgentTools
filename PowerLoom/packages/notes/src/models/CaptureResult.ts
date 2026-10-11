// What `vault-capture.ps1 capture` prints.
export interface CaptureResult {
  ok: boolean;
  mode: "created" | "appended" | "rejected";
  path: string | null;
  errors: string[];
}
