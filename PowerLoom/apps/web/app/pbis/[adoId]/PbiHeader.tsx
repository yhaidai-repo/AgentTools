import { isFinishable, readAdoSettings, workItemUrl } from "@powerloom/core";
import Link from "next/link";
import { AdoTag } from "@/components/AdoTag";
import { ContinueChat } from "@/components/ContinueChat";
import { NoteLink } from "@/components/NoteLink";
import { PipelinePill } from "@/components/PipelinePill";
import { TimeAgo } from "@/components/TimeAgo";
import { TypeTag } from "@/components/TypeTag";
import { getDb } from "@/lib/db";
import { formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { isOpen } from "@/lib/items";
import type { PbiDetail } from "@/lib/pbiDetail";
import { personName } from "@/lib/personName";
import { sprintName } from "@/lib/sprintProgress";
import type { MetroStation } from "@/models/MetroStation";
import { ContextSize } from "./ContextSize";
import { FinishPbiButton } from "./FinishPbiButton";
import { MoreActions } from "./MoreActions";
import { PipelineMetro } from "./PipelineMetro";
import { PreparePbiButton } from "./PreparePbiButton";
import { RunningStrip } from "./RunningStrip";

// Everything about the PBI at hand (user request 2026-10-18): what it is, one primary action, its facts, five numbers,
// the agent running now, and its way through the pipeline.
export async function PbiHeader({ detail, stations, changedAt }: { detail: PbiDetail; stations: MetroStation[]; changedAt: Date }) {
  const { pbi } = detail;
  const running = detail.runs.find((run) => run.outcome === "running") ?? null;
  const adoUrl = workItemUrl(await readAdoSettings(getDb(), pbi.vault), pbi);

  return (
    <section className="pbi-hero">
      <div className="hero-top">
        <div className="hero-title">
          <div className="hero-id"><span className="id">{pbi.adoId}</span><AdoTag url={adoUrl} /><TypeTag type={pbi.type} bugSource={detail.bug?.source ?? null} /><PipelinePill status={pbi.pipelineStatus} /></div>
          <h1>{pbi.title}</h1>
        </div>
        <div className="hero-actions">
          <Continue detail={detail} />
          <PreparePbiButton adoId={pbi.adoId} />
          {isFinishable(pbi.pipelineStatus) && <FinishPbiButton adoId={pbi.adoId} title={pbi.title} />}
          <MoreActions adoId={pbi.adoId} closedByUser={pbi.closedByUser} isClosed={pbi.pipelineStatus === "closed"} />
        </div>
      </div>
      <Facts detail={detail} changedAt={changedAt} />
      <Stats detail={detail} />
      {running && <RunningStrip run={running} adoId={pbi.adoId} />}
      <PipelineMetro stations={stations} status={pbi.pipelineStatus} running={running !== null} />
    </section>
  );
}

// Shown once there is a design, or once refinement alone made the PBI ready for dev (the chat then plans from the
// refinement); the reason it's disabled comes from the same check the click runs.
function Continue({ detail }: { detail: PbiDetail }) {
  const isReadyForDev = detail.pbi.pipelineStatus === "ready-for-dev";

  return detail.design || isReadyForDev ? <ContinueChat target={{ kind: "pbi", adoId: detail.pbi.adoId }} /> : null;
}

// The PBI's facts on one line: links are the dotted ones.
function Facts({ detail, changedAt }: { detail: PbiDetail; changedAt: Date }) {
  const { pbi } = detail;

  return (
    <div className="hero-facts">
      {pbi.source === "ado" && <Fact label="ADO">{pbi.adoState}</Fact>}
      {pbi.iterationPath && <Fact label="Sprint"><span className="mono">{sprintName(pbi.iterationPath)}</span></Fact>}
      {pbi.priority !== null && <Fact label="Priority"><span className="mono">P{pbi.priority}</span></Fact>}
      {pbi.assignedTo && <Fact label="Assigned"><span title={pbi.assignedTo}>{personName(pbi.assignedTo)}</span></Fact>}
      {detail.repos.length > 0 && <Fact label="Repo">{detail.repos.map((repo) => repo.name).join(", ")}</Fact>}
      {detail.parent && <Fact label="Child of"><Link href={`/pbis/${detail.parent.adoId}`}>PBI-{detail.parent.adoId}</Link></Fact>}
      <Fact label="Updated"><span className="mono"><TimeAgo date={changedAt} /></span></Fact>
      {pbi.vaultPath ? <span className="fact-link"><NoteLink vault={pbi.vault} path={pbi.vaultPath} label="Vault note" /></span> : <span className="text-faint">no note yet: Start writes it</span>}
      <ContextSize pbi={pbi} />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <span className="fact"><b>{label}</b>{children}</span>;
}

// Waiting on you breathes amber; blockers are the open items and unmerged drafts that hold the agents.
function Stats({ detail }: { detail: PbiDetail }) {
  const open = detail.items.filter((item) => isOpen(item) && item.kind !== "finding");
  const forYou = open.filter((item) => item.assignee === "human").length;
  const blockers = open.length + detail.drafts.filter((draft) => ["pending", "created", "appended"].includes(draft.status)).length;
  const estimate = estimateOf(detail);

  return (
    <div className="hero-stats">
      <Stat label="Waiting on you" value={String(forYou)} tone={forYou > 0 ? "warn" : undefined} />
      <Stat label="Blockers" value={blockers === 0 ? "None" : String(blockers)} tone={blockers === 0 ? "good" : undefined} />
      <Stat label="Estimate" value={estimate ? `~${estimate.hours} h` : "–"} note={estimate ? `human${estimate.agentHours === null ? "" : ` · ~${estimate.agentHours} h agent`}` : undefined} />
      <Stat label="Agent time" value={formatDuration(detail.usage.durationMs)} note={`${detail.runs.length} runs`} />
      <Stat label="Agent cost" value={formatUsd(detail.usage.costUsd)} note={`${formatTokens(detail.usage.tokens)} tokens`} />
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" | "good" }) {
  return (
    <div className={`hero-stat${tone ? ` ${tone}` : ""}`}>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{value}{note && <small>{note}</small>}</div>
    </div>
  );
}

// The agents' estimate, split (user request 2026-10-18): human time from the design, else the refinement (design is
// later and finer); agent time from the design only.
function estimateOf(detail: PbiDetail): { hours: number; agentHours: number | null } | null {
  if (detail.design?.estHumanH) {
    return { hours: Number(detail.design.estHumanH), agentHours: detail.design.estAgentH ? Number(detail.design.estAgentH) : null };
  }

  return detail.refinement?.estHours ? { hours: Number(detail.refinement.estHours), agentHours: null } : null;
}
