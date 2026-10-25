import { readGoogleDriveSettings } from "@powerloom/core";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { GOOGLE_SIGN_IN_COOKIE, GOOGLE_SIGN_IN_PATH, googleAuthUrl, newPendingSignIn, redirectUriOf, settingsUrlWith } from "@/lib/googleSignIn";

// "Sign in with Google": off to Google's consent page with the vault's OAuth client.
export async function GET(request: Request) {
  const vault = await currentVault();
  const settings = vault ? await readGoogleDriveSettings(getDb(), vault) : null;

  if (!vault || !settings?.clientId) {
    return NextResponse.redirect(new URL(settingsUrlWith("Save the Google OAuth client first."), request.url));
  }

  const pending = newPendingSignIn(vault);

  (await cookies()).set(GOOGLE_SIGN_IN_COOKIE, JSON.stringify(pending), { httpOnly: true, sameSite: "lax", path: GOOGLE_SIGN_IN_PATH, maxAge: 600 });

  return NextResponse.redirect(googleAuthUrl(settings.clientId, redirectUriOf(request.headers.get("host") ?? "127.0.0.1:3100"), pending));
}
