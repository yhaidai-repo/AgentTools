import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { browserOriginOf, googleAuthUrl, newPendingSignIn, redirectUriOf, settingsUrlWith } from "./googleSignIn";

describe("Sign in with Google", () => {
  it("asks for read-only Drive with PKCE and comes back to this page", () => {
    const pending = newPendingSignIn("work");
    const url = new URL(googleAuthUrl("client-1", redirectUriOf("http://127.0.0.1:3100"), pending));

    assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:3100/settings/google-drive/callback");
    assert.equal(url.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/drive.readonly");
    assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(pending.verifier).digest("base64url"));
    assert.equal(url.searchParams.get("state"), pending.state);
    assert.equal(url.searchParams.get("access_type"), "offline");
  });

  it("comes back on the address the browser used, not the container's own port", () => {
    const origin = browserOriginOf(new Headers({ host: "localhost:3100" }));

    assert.equal(redirectUriOf(origin), "http://localhost:3100/settings/google-drive/callback");
    assert.equal(settingsUrlWith(origin, "Signed in"), "http://localhost:3100/settings?tab=data&drive=Signed%20in");
  });

  it("follows a proxy's forwarded address", () => {
    const headers = new Headers({ host: "web:3000", "x-forwarded-host": "powerloom.example", "x-forwarded-proto": "https" });

    assert.equal(browserOriginOf(headers), "https://powerloom.example");
  });

  it("starts every sign-in with its own state and verifier", () => {
    assert.notEqual(newPendingSignIn("work").state, newPendingSignIn("work").state);
  });
});
