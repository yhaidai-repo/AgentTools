// Settings' test of a vault's DevHub: a failed check is an answer, not an error.
export interface DevHubCheck {
  ok: boolean;
  message: string;
}
