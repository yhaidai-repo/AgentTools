// A bearer token of the vault's sign-in for one API (its resource URL), as the runner hands them out; throws
// NotSignedInError when nobody signed in.
export type TokenProvider = (resource: string) => Promise<string>;
