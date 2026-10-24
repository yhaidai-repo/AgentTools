// Nobody signed in for Azure on this vault (or the sign-in expired): the `az` shim answers as a signed-out az would,
// the tools answer `denied`, which raises an access request asking the user to sign in again.
export class NotSignedInError extends Error {
  constructor(vault: string) {
    super(`Nobody is signed in for Azure on ${vault}: Settings → Read Azure → Sign in with my account.`);
    this.name = "NotSignedInError";
  }
}
