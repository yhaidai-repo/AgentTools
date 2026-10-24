/** `none`: no sign-in was started; `pending` while the user hasn't finished at the link; `done`; `failed` with why. */
export interface CodexLoginStatus {
  status: "none" | "pending" | "done" | "failed";
  error: string | null;
  output: string;
}
