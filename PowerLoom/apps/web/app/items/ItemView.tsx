import { attachmentRef, isHumanTaskData, type FindingData } from "@powerloom/core";
import { ACCEPTED_EXTENSIONS } from "@powerloom/attachments";
import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { ResultTabs } from "@/components/ResultTabs";
import { isOpen, itemPath } from "@/lib/items";
import type { ItemDetail } from "@/lib/pbiDetail";
import { writtenNotes } from "@/lib/writtenNotes";
import { DocLink } from "../vault/DocLink";
import { CloseItemForm } from "./CloseItemForm";
import { ItemHeader } from "./ItemHeader";
import { FindingForm } from "./FindingForm";
import { StepView } from "./HumanTaskContent";
import { ItemContent } from "./ItemContent";
import { TaskNotesForm } from "./TaskNotesForm";
import { TaskResults } from "./TaskResults";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

// One item's page, under its PBI or (for items without one) under Tasks.
export function ItemView({ detail }: { detail: ItemDetail }) {
  const { item } = detail;
  return (
    <>
      <ItemHeader detail={detail} />
      {item.status === "deleted" && <p className="result-error">Deleted: hidden everywhere; agents won&apos;t create it again.</p>}
      <ItemContent item={item} />
      <TaskNotes detail={detail} />
      <AgentResult detail={detail} />
      <DocsResult detail={detail} />
      <TaskResults detail={detail} />
      <Results detail={detail} />
      <Findings detail={detail} />
      <Resolution detail={detail} />
    </>
  );
}

// A test task's own notes (user decision 2026-10-21): editable at any time, read by the agent on every run.
function TaskNotes({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  if (item.kind !== "test") {
    return null;
  }

  return (
    <>
      <h2>My notes</h2>
      <p className="hint">The test agent reads these on every run: test data, the environment, cases to check first.</p>
      <TaskNotesForm itemId={item.id} path={itemPath(item)} text={((item.data ?? {}) as { userNotes?: string }).userNotes ?? ""} />
    </>
  );
}

// An agent task that ran without a PBI (a goal, or a task created on the Tasks page) keeps its result as its resolution,
// in Markdown (Better Research's goal path); a PBI task's results are separate items, shown by Results.
function AgentResult({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  if (item.assignee === "human" || item.kind === "docs" || !item.resolution) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · {item.status}</h2>
      <MarkdownBlock text={item.resolution} />
    </section>
  );
}

// A docs task's result (user, 2026-10-15): the tech-writer's last message and the notes its latest successful run wrote,
// each opening in Obsidian.
function DocsResult({ detail }: { detail: ItemDetail }) {
  const { item } = detail;
  const run = detail.runs.find((candidate) => candidate.outcome === "success");
  const notes = run ? writtenNotes(run.outputs, item.vault) : [];

  if (item.kind !== "docs" || (!item.resolution && notes.length === 0)) {
    return null;
  }

  return (
    <section className="card result-section">
      <h2>Result · {item.status}{run ? ` · RUN-${run.id}` : ""}</h2>
      {item.resolution && <MarkdownBlock text={item.resolution} />}
      {notes.length > 0 && <ul className="item-list">{notes.map((path) => <li key={path}><DocLink vault={item.vault} path={path} /></li>)}</ul>}
    </section>
  );
}

// A research task shows its results and a test task its reports inside it (newest last; a re-run supersedes the
// earlier one).
function Results({ detail }: { detail: ItemDetail }) {
  if (detail.item.kind !== "research" && detail.item.kind !== "test") {
    return null;
  }

  if (detail.results.length === 0) {
    return detail.item.resolution ? null : <p className="muted">No result yet.</p>;
  }

  const tabs = detail.results.map((result) => ({
    key: result.id,
    label: `${result.id}${result.createdByRun ? ` · RUN-${result.createdByRun}` : ""}`,
    content: (
      <section className="card result-section">
        <h2>{result.kind === "test-report" ? "Report" : "Result"} {result.id} · {result.status}{result.createdByRun ? ` · RUN-${result.createdByRun}` : ""}</h2>
        <ItemContent item={result} />
      </section>
    ),
  }));

  return <ResultTabs tabs={tabs} />;
}

// Open questions and known issues the tech-writer raised while merging this task's draft.
function Findings({ detail }: { detail: ItemDetail }) {
  if (detail.findings.length === 0) {
    return null;
  }

  return (
    <>
      <h2>Findings</h2>
      <ul className="item-list">
        {detail.findings.map((finding) => (
          <li key={finding.id}><Link href={itemPath(finding)}>{finding.id}</Link> · {finding.status} · {finding.title}</li>
        ))}
      </ul>
    </>
  );
}

// Open human items get their forms; closed ones show what was answered and uploaded.
function Resolution({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  if (item.assignee !== "human") {
    return null;
  }

  if (item.kind === "finding" && item.status === "in-progress") {
    return <p className="muted">Being added to the register; reload in a moment.</p>;
  }

  return isOpen(item) ? <OpenForms detail={detail} /> : <ClosedOutcome detail={detail} />;
}

function OpenForms({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  const steps = isHumanTaskData(item.data) ? item.data.steps : [];

  if (item.kind !== "finding") {
    return (
      <>
        <h2 id="answer">{item.kind === "question" ? "Your answer" : "Close the task"}</h2>
        <CloseItemForm adoId={item.pbiId} itemId={item.id} kind={item.kind} accept={ACCEPT} steps={steps} stepViews={steps.map((step, index) => <StepView key={index} step={step} />)} />
      </>
    );
  }

  return (
    <>
      <h2 id="answer">Submit to vault</h2>
      <FindingForm adoId={item.pbiId} itemId={item.id} title={item.title} text={item.body ?? ""} data={item.data as FindingData} />
      <h2>Or close it here</h2>
      <CloseItemForm adoId={item.pbiId} itemId={item.id} kind={item.kind} accept={ACCEPT} />
    </>
  );
}

function ClosedOutcome({ detail }: { detail: ItemDetail }) {
  const { item, attachments } = detail;

  return (
    <>
      <h2>{item.kind === "human" ? "Outcome" : "Answer"}</h2>
      <p>{item.status}</p>
      {item.resolution && <ResolutionText text={item.resolution} />}
      {attachments.length > 0 && (
        <ul>
          {attachments.map((entry) => <li key={entry.id}><a href={`/pbis/${item.pbiId}/attachments/${entry.id}`}>{attachmentRef(entry.id)} {entry.fileName}</a></li>)}
        </ul>
      )}
    </>
  );
}

// Per-step answers are markdown (headings, JSON in code blocks); older answers are plain text, kept with their line breaks.
function ResolutionText({ text }: { text: string }) {
  return /^### /m.test(text) ? <MarkdownBlock text={text} /> : <div className="text-block">{text}</div>;
}
