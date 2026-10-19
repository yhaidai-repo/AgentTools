"use client";

import { useActionState } from "react";
import type { AzureResourceKind } from "@powerloom/core";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { saveReadAzureKindAction } from "./actions";

// One kind's card head (user decision 2026-10-13: a feature per kind); its switch saves as soon as it flips, like the
// rows under it (user decision 2026-10-18).
export function ReadAzureSwitchForm({ kind, title, help, enabled }: { kind: AzureResourceKind; title: string; help: string; enabled: boolean }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(saveReadAzureKindAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <SettingsHead key={String(enabled)} title={title} description={help} enabled={enabled} onToggle={(event) => event.currentTarget.form?.requestSubmit()} />
      {result && !result.ok && <p className="settings-body"><ResultLine result={result} /></p>}
    </form>
  );
}
