"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { saveReadSqlAction } from "./actions";

// The card's head: its switch saves as soon as it flips, like the rows under it (user decision 2026-10-18).
export function ReadSqlSwitchForm({ enabled }: { enabled: boolean }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(saveReadSqlAction, null);

  return (
    <form action={action}>
      <SettingsHead key={String(enabled)} title="Read SQL" description="Read-only queries on these SQL Server databases, by agents with their own Read SQL switch on." enabled={enabled} onToggle={(event) => event.currentTarget.form?.requestSubmit()} />
      {result && !result.ok && <p className="settings-body"><ResultLine result={result} /></p>}
    </form>
  );
}
