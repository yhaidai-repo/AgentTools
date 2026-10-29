"use client";
import { useState } from "react";
import { DEMONSTRATION_LABEL, readGuideRequest } from "@powerloom/core/support-guides";

export function GuideFields({ description, raw = {} }: { description: string; raw?: Record<string, string> }) {
  let previous;
  try { previous = readGuideRequest(description); } catch {}
  const [mode, setMode] = useState(raw.guideMode as "remote-url" | "local-stack" ?? previous?.mode ?? "remote-url");
  const destination = previous?.destination;
  const [action, setAction] = useState(raw.guidePublishAction as "create" | "update" | "unspecified" ?? destination?.action ?? "unspecified");
  return <fieldset className="panel">
    <legend>{DEMONSTRATION_LABEL}</legend>
    <label className="field">Run against<select name="guideMode" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="remote-url">Existing URL</option><option value="local-stack">Local DevHub build</option></select></label>
    <label className="field">Entry URL<input name="guideUrl" type="url" defaultValue={raw.guideUrl ?? previous?.url} required placeholder="https://app.example.com/admin" /></label>
    <label className="field">Allowed sign-in and application origins<input name="guideOrigins" defaultValue={raw.guideOrigins ?? previous?.allowedOrigins.join(", ")} placeholder="https://app.example.com, https://login.example.com" /></label>
    {mode === "local-stack" && <>
      <label className="field">Branch<input name="guideBranch" defaultValue={raw.guideBranch ?? previous?.branch} required /></label>
      <label className="field">DevHub services<input name="guideServices" defaultValue={raw.guideServices ?? previous?.services.join(", ")} placeholder="pvs-web, pvs-api" required /></label>
    </>}
    <label className="field">Audience and role<input name="guideAudience" defaultValue={raw.guideAudience ?? previous?.audience} required /></label>
    <label className="field">Environment<input name="guideEnvironment" defaultValue={raw.guideEnvironment ?? previous?.environment} placeholder="Development" required /></label>
    <label className="field">Permitted actions<textarea name="guideActions" defaultValue={raw.guideActions ?? previous?.permittedActions} placeholder="Which reads or changes may this walkthrough make?" required /></label>
    <label className="field">Demonstration data and secret names<textarea name="guideData" defaultValue={raw.guideData ?? previous?.data} placeholder="Record scope and secret names; never passwords" required /></label>
    <label className="field">Always mask in screenshots (CSS selectors)<input name="guideMasks" defaultValue={raw.guideMasks ?? previous?.maskSelectors.join(", ")} placeholder="[data-sensitive], .patient-ssn (password fields always are)" /></label>
    <label className="field">Guide owner<input name="guideOwner" defaultValue={raw.guideOwner ?? previous?.owner} required /></label>
    <label className="field">Applicable release<input name="guideRelease" defaultValue={raw.guideRelease ?? previous?.release} placeholder="Optional; must match verified deployment" /></label>
    <label className="field">Confluence destination<select name="guidePublishAction" value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="unspecified">Decide later</option><option value="create">New page</option><option value="update">Update page</option></select></label>
    {action !== "unspecified" && <>
      <label className="field">Confluence site<input name="guideSite" defaultValue={raw.guideSite ?? (destination && destination.action !== "unspecified" ? destination.site : "")} required /></label>
      <label className="field">Space<input name="guideSpace" defaultValue={raw.guideSpace ?? (destination && destination.action !== "unspecified" ? destination.space : "")} required /></label>
      <label className="field">Page title<input name="guidePageTitle" defaultValue={raw.guidePageTitle ?? (destination && destination.action !== "unspecified" ? destination.title : "")} required /></label>
      <label className="field">{action === "create" ? "Parent page id" : "Existing page id"}<input name="guidePageId" defaultValue={raw.guidePageId ?? (destination?.action === "create" ? destination.parentId : destination?.action === "update" ? destination.pageId : "")} required /></label>
      {action === "update" && <>
        <label className="field">Current page version<input type="number" name="guidePageVersion" min={1} defaultValue={raw.guidePageVersion ?? (destination?.action === "update" ? destination.version : undefined)} required /></label>
        <label className="field">Sections to update<input name="guideSections" defaultValue={raw.guideSections ?? (destination?.action === "update" ? destination.sections : "")} required /></label>
      </>}
    </>}
  </fieldset>;
}
