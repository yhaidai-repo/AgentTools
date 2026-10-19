"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AgentsGlobal } from "@agenttools/config";
import { DailyBudgetStatus } from "@/components/DailyBudgetStatus";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { ActionResult } from "@/models/ActionResult";
import { saveGlobalAction } from "../agents/configActions";

// The daily budget of all agents together; each agent's own model, schedule and limits are on its config page.
export function GlobalAgentForm({ global, spentTodayUsd }: { global: AgentsGlobal; spentTodayUsd: number }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveGlobalAction, null);

  return (
    <form action={action} className="panel settings-card">
      <SettingsHead title="Daily budget" description={<>All agents together, API-price estimate. Each agent&apos;s own model, schedule and limits are on <Link href="/agents">Agents</Link>.</>} />
      <div className="settings-body field-grid">
        <label className="field"><span>Budget per day, $</span><input name="dailyBudgetUsd" type="number" step="0.5" min={0} defaultValue={global.dailyBudgetUsd} required /></label>
        <div className="field"><span>Used today</span><DailyBudgetStatus spentUsd={spentTodayUsd} limitUsd={global.dailyBudgetUsd} /></div>
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
