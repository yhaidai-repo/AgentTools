import { createHash, randomBytes } from "node:crypto";

// Sign in with Google for Drive (user decision 2026-10-25): the user's own OAuth client (a Desktop app, whose loopback
// redirect accepts this page's address), PKCE, read-only Drive plus the account's email. The verifier and state wait in
// a short-lived cookie between the two routes.
export const GOOGLE_SIGN_IN_COOKIE = "powerloom-google-sign-in";
export const GOOGLE_SIGN_IN_PATH = "/settings/google-drive";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.readonly"];

export interface PendingSignIn {
  vault: string;
  state: string;
  verifier: string;
}

export function newPendingSignIn(vault: string): PendingSignIn {
  return { vault, state: base64Url(randomBytes(24)), verifier: base64Url(randomBytes(48)) };
}

// Where Google sends the browser back: this page's own address (the browser reaches PowerLoom on a loopback address).
export function redirectUriOf(host: string): string {
  return `http://${host}${GOOGLE_SIGN_IN_PATH}/callback`;
}

export function googleAuthUrl(clientId: string, redirectUri: string, pending: PendingSignIn): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // A refresh token on every sign-in, so a second sign-in replaces the first.
    access_type: "offline",
    prompt: "consent",
    code_challenge: base64Url(createHash("sha256").update(pending.verifier).digest()),
    code_challenge_method: "S256",
    state: pending.state,
  });

  return `${AUTH_URL}?${params}`;
}

// The Data access tab with a line on how the sign-in went.
export function settingsUrlWith(message: string): string {
  return `/settings?tab=data&drive=${encodeURIComponent(message)}`;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}
