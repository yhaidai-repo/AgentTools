// The connection test's outcome as the Settings page shows it: a failed check is an answer, not an error.
export interface SqlConnectionCheck {
  ok: boolean;
  message: string;
}
