// Nobody signed in for App Insights on this vault (or the sign-in expired): the readers answer `denied`, which raises
// an access request asking the user to sign in again.
export class NotSignedInError extends Error {
  constructor(vault: string) {
    super(`Nobody is signed in for App Insights on ${vault}: Settings → Read Azure → App Insights → Sign in.`);
    this.name = "NotSignedInError";
  }
}
