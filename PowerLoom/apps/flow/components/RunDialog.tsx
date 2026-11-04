"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { runFlowAction } from "@/app/actions";
import type { PbiTarget, RunTargets, TaskTarget } from "@/lib/targets";

type Tab = "pbi" | "task";

// Run a flow: pick what it runs for, a PBI or an open task of the vault (lists from /api/targets), then flow.run; the
// browser goes to the new execution's page.
export function RunDialog({ flowId, flowName, onClose }: { flowId: string; flowName: string; onClose: () => void }) {
  const router = useRouter();
  const [targets, setTargets] = useState<RunTargets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pbi");
  const [search, setSearch] = useState("");
  const [pbiId, setPbiId] = useState<number | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/targets", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The targets could not be read (${response.status}).`);
        const loaded = (await response.json()) as RunTargets;

        if (!cancelled) setTargets(loaded);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needle = search.trim().toLowerCase();
  const pbis = useMemo(() => (targets?.pbis ?? []).filter((pbi) => matchesPbi(pbi, needle)).slice(0, 100), [targets, needle]);
  const tasks = useMemo(() => (targets?.tasks ?? []).filter((task) => matchesTask(task, needle)).slice(0, 100), [targets, needle]);
  const chosen = tab === "pbi" ? (pbiId === null ? null : `PBI-${pbiId}`) : itemId;

  const run = async () => {
    const target = tab === "pbi" ? (pbiId === null ? null : { kind: "pbi" as const, pbiId }) : (itemId === null ? null : { kind: "task" as const, itemId });

    if (!target) return;
    setBusy(true);
    setError(null);

    const outcome = await runFlowAction(flowId, target);

    if (outcome.ok) {
      router.push(`/executions/${encodeURIComponent(outcome.value.executionId)}`);
    } else {
      setError(outcome.error);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="run-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2 id="run-dialog-title">Run “{flowName}”</h2>
          <button type="button" className="secondary small" onClick={onClose}>Close</button>
        </div>
        <p className="muted">What does the flow run for? The first nodes get their tasks at once; the rest follow as the flow advances.</p>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "pbi"} className={`tab${tab === "pbi" ? " active" : ""}`} onClick={() => setTab("pbi")}>A PBI {targets && <span className="count">{targets.pbis.length}</span>}</button>
          <button type="button" role="tab" aria-selected={tab === "task"} className={`tab${tab === "task" ? " active" : ""}`} onClick={() => setTab("task")}>An open task {targets && <span className="count">{targets.tasks.length}</span>}</button>
        </div>
        <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "pbi" ? "Search by id, title or status" : "Search by id, title, kind or status"} aria-label="Search" autoFocus />
        <div className="target-list">
          {loadError && <div className="problems">{loadError}</div>}
          {!targets && !loadError && <p className="muted">Loading…</p>}
          {targets && tab === "pbi" && (pbis.length === 0
            ? <p className="muted">No PBI matches.</p>
            : pbis.map((pbi) => (
              <button type="button" key={pbi.pbiId} className={`target${pbiId === pbi.pbiId ? " chosen" : ""}`} onClick={() => setPbiId(pbi.pbiId)}>
                <span className="id">PBI-{pbi.pbiId}</span>
                <span className="title">{pbi.title}</span>
                <span className="chip">{pbi.status}</span>
              </button>
            )))}
          {targets && tab === "task" && (tasks.length === 0
            ? <p className="muted">No open task matches.</p>
            : tasks.map((task) => (
              <button type="button" key={task.itemId} className={`target${itemId === task.itemId ? " chosen" : ""}`} onClick={() => setItemId(task.itemId)}>
                <span className="id">{task.itemId}</span>
                <span className="title">{task.title}<span className="faint"> · {task.kind}{task.pbiId === null ? "" : ` · PBI-${task.pbiId}`}</span></span>
                <span className="chip">{task.status}</span>
              </button>
            )))}
        </div>
        {error && <div className="problems">{error}</div>}
        <div className="modal-foot">
          <span className="muted">{chosen ? `Runs for ${chosen}` : "Pick a target"}</span>
          <button type="button" onClick={run} disabled={busy || chosen === null}>{busy ? "Starting…" : "Run"}</button>
        </div>
      </div>
    </div>
  );
}

function matchesPbi(pbi: PbiTarget, needle: string): boolean {
  return needle === "" || `pbi-${pbi.pbiId} ${pbi.title} ${pbi.status} ${pbi.type}`.toLowerCase().includes(needle);
}

function matchesTask(task: TaskTarget, needle: string): boolean {
  return needle === "" || `${task.itemId} ${task.title} ${task.kind} ${task.status} pbi-${task.pbiId ?? ""}`.toLowerCase().includes(needle);
}
