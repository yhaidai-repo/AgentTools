"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { AzureLoginStart } from "@/models/AzureLoginStart";
import type { AzureUserAccount } from "@powerloom/core";
import { azureLoginStatusAction, signOutAzureAction, startAzureLoginAction } from "./actions";

// How often the page asks whether the user finished at the link.
const POLL_MS = 3000;

// Sign in with your own account (user decisions 2026-10-13/14): Entra hands out a code, you type it at the link, the
// runner keeps the sign-in and hands its tokens to the Azure MCP server. One account per vault.
export function AzureUserLoginForm({ account }: { account: AzureUserAccount | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [started, setStarted] = useState<AzureLoginStart | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!started) {
      return;
    }

    const timer = setInterval(async () => {
      const status = await azureLoginStatusAction(started.flowId);

      if (status.status === "pending") {
        return;
      }

      setStarted(null);
      setError(status.status === "failed" ? status.error ?? "The sign-in failed." : null);
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [started, router]);

  const start = () => startTransition(async () => {
    const result = await startAzureLoginAction();

    setError(result.ok ? null : result.message);
    setStarted(result.ok ? result.start : null);
  });

  if (started) {
    return (
      <div>
        <p>
          Open <a href={started.verificationUri} target="_blank" rel="noreferrer">{started.verificationUri}</a> and enter the code <strong><code>{started.userCode}</code></strong>, then sign in with your work account. This page updates by itself when you&apos;re done.
        </p>
        <p className="muted">The code expires in {Math.round(started.expiresInSeconds / 60)} minutes.</p>
      </div>
    );
  }

  return (
    <div>
      {account ? (
        <p>
          Signed in as <strong>{account.username}</strong> (since {new Date(account.signedInAt).toLocaleString()}).{" "}
          <button type="button" className="secondary" disabled={isPending} onClick={() => startTransition(() => signOutAzureAction())}>Sign out</button>
        </p>
      ) : (
        <p>
          Nobody is signed in for Azure.{" "}
          <button type="button" disabled={isPending} onClick={start}>{isPending ? "Starting…" : "Sign in with my account"}</button>
        </p>
      )}
      {error && <p className="result-error">{error}</p>}
    </div>
  );
}
