"use client";

import { useActionState, useEffect, useState } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { WebSearchSetting } from "@/lib/webSearch";
import type { ActionResult } from "@/models/ActionResult";
import { saveWebSearchAction } from "./actions";

// SearXNG's own default: it picks the language from the query.
const UNSET_LANGUAGE = "auto";

// Settings → Data access → Web search (user decision 2026-10-28): agents with PowerLoom web on search through the
// SearXNG next to PowerLoom, from this PC's address, at the pace set here. Until the search is set up, the language is
// this PC's.
export function WebSearchForm({ setting }: { setting: WebSearchSetting | null }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveWebSearchAction, null);
  const [language, setLanguage] = useState(setting?.language ?? UNSET_LANGUAGE);

  useEffect(() => {
    if (!setting?.enabled && language === UNSET_LANGUAGE) {
      setLanguage(navigator.language);
    }
  }, [setting?.enabled, language]);

  if (!setting) {
    return <p className="hint text-warn">Web search: unknown, PowerLoom isn't reachable.</p>;
  }

  return (
    <KeptForm action={action} clearOn={result} className="panel settings-card">
      <SettingsHead title="Web search" description="For the whole PowerLoom, not only this vault. Agents with PowerLoom web switched on get search_web: PowerLoom's own SearXNG, searching Google, Bing and other engines from this PC. Engines may refuse automated searches; a refusal is logged and the agent uses its own search." enabled={setting.enabled} />
      <div className="settings-body">
        <div className="field-grid">
          <label className="field"><span>SearXNG URL<small>as the agent-runner reaches it</small></span><input name="url" defaultValue={setting.url} placeholder="http://searxng:8080" /></label>
          <label className="field"><span>Language<small>e.g. uk-UA, en, auto</small></span><input name="language" value={language} onChange={(event) => setLanguage(event.target.value)} /></label>
          <label className="field"><span>Searches per run<small>a run beyond it uses its own search</small></span><input name="maxSearchesPerRun" type="number" min={1} max={100} defaultValue={setting.maxSearchesPerRun} /></label>
          <label className="field"><span>Seconds between searches<small>across all runs</small></span><input name="minSecondsBetweenSearches" type="number" min={0} max={60} defaultValue={setting.minSecondsBetweenSearches} /></label>
          <label className="field"><span>Cache hours<small>the same search is answered from the cache</small></span><input name="cacheHours" type="number" min={0} max={168} defaultValue={setting.cacheHours} /></label>
        </div>
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}
