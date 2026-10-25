import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GOOGLE_SIGN_IN_COOKIE, redirectUriOf, settingsUrlWith, type PendingSignIn } from "@/lib/googleSignIn";
import { powerloom, powerloomResult } from "@/lib/powerloom";

// Google sends the browser back here; PowerLoom trades the code for the account's refresh token (the secret and the
// token stay there), then the Data access tab says how it went.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const pending = pendingOf(store.get(GOOGLE_SIGN_IN_COOKIE)?.value);
  const back = (message: string) => NextResponse.redirect(new URL(settingsUrlWith(message), request.url));

  store.delete(GOOGLE_SIGN_IN_COOKIE);

  if (url.searchParams.get("error")) {
    return back(`Google didn't sign in: ${url.searchParams.get("error")}.`);
  }

  if (!pending || pending.state !== url.searchParams.get("state")) {
    return back("The sign-in expired or didn't start here: sign in again.");
  }

  const signedIn = await powerloom.POST("/api/vaults/{vault}/google-drive/sign-in", {
    params: { path: { vault: pending.vault } },
    body: { code: url.searchParams.get("code") ?? "", codeVerifier: pending.verifier, redirectUri: redirectUriOf(request.headers.get("host") ?? "127.0.0.1:3100") },
  });

  return back(powerloomResult(signedIn, `Signed in as ${signedIn.data?.account ?? "your account"}: add the folders agents may read.`).message);
}

function pendingOf(cookie: string | undefined): PendingSignIn | null {
  try {
    return cookie ? (JSON.parse(cookie) as PendingSignIn) : null;
  } catch {
    return null;
  }
}
