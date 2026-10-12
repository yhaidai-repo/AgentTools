// The sign-in test's outcome as the Settings page shows it: a failed check is an answer, not an error.
export interface AzureIdentityCheck {
  ok: boolean;
  message: string;
}
