import { SupportGuideContent } from "./SupportGuideContent";
import { isHumanTaskData } from "@powerloom/core";
import { PbiLinkedText } from "@/components/PbiLinkedText";
import { isOpen } from "@/lib/items";
import type { ItemRow } from "@/lib/pbiDetail";
import { HumanTaskContent } from "./HumanTaskContent";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { MarkdownText } from "@/components/MarkdownText";

type ItemData = {
  why?: string;
  options?: string[];
  url?: string;
  goal?: string;
  depth?: number;
  needsWeb?: boolean;
  sources?: string[];
  confidence?: string;
  findings?: string[];
  evidence?: { location: string; note: string }[];
  relevantDocs?: { path: string; why: string }[];
  codeRefs?: { location: string; why: string }[];
  type?: string;
  project?: string;
  default?: string[];
  draft?: string;
  path?: string;
  target?: string;
  source?: string;
  captured?: string;
  createdBy?: string;
  doneWhen?: string;
  repos?: string[];
};

type Render = (item: ItemRow, data: ItemData, editable: boolean) => React.ReactNode;

const CONTENT: Record<string, Render> = {
  question: QuestionContent,
  human: HumanContent,
  research: ResearchTaskContent,
  "research-result": ResearchResultContent,
  "test-report": TestReportContent,
  "support-guide-result": item => <SupportGuideContent item={item} />,
  finding: FindingContent,
  docs: DocsTaskContent,
};

// The full content of one item, laid out per kind; a task the user created looks the same whatever its kind. `editable`:
// the page shows the task's text as fields (EditTaskForm), so its sections here are left out.
export function ItemContent({ item, editable = false }: { item: ItemRow; editable?: boolean }) {
  const data = (item.data ?? {}) as ItemData;
  const render: Render = data.createdBy === "user" ? UserTaskContent : (CONTENT[item.kind] ?? DetailsContent);

  return <>{render(item, data, editable)}</>;
}

function DetailsContent(item: ItemRow, _data: ItemData, editable: boolean) {
  return editable ? null : <Section title="Details" text={item.body} />;
}

// Created on the Tasks page (user decision 2026-10-14): what to do, when it is done, and the note or repos it works on.
function UserTaskContent(item: ItemRow, data: ItemData, editable: boolean) {
  return (
    <>
      {!editable && <Section title="Description" text={item.body} />}
      {!editable && <Section title="Acceptance criteria" text={data.doneWhen} />}
      {data.path && <p>Note: <code>{data.path}</code></p>}
      {data.repos && data.repos.length > 0 && <p>Repositories: {data.repos.join(", ")}</p>}
    </>
  );
}

function QuestionContent(item: ItemRow, data: ItemData) {
  return (
    <>
      <Section title="Question" text={item.body} />
      <Section title="Why it matters" text={data.why} />
      <Bullets title="Options" items={data.options} />
      {data.url && <p>Linked document: <a href={data.url} target="_blank" rel="noreferrer">{data.url}</a>. Upload its content below to answer.</p>}
    </>
  );
}

// Agents' tasks are structured since 2026-10-05; older ones and the app's own document tasks are free text, markdown too.
function HumanContent(item: ItemRow) {
  return isHumanTaskData(item.data) ? <HumanTaskContent data={item.data} withSteps={!isOpen(item)} /> : <HumanTaskText text={item.body} />;
}

function HumanTaskText({ text }: { text: string | null }) {
  return (
    <>
      <h2>Task</h2>
      {text ? <MarkdownText text={text} /> : <p className="muted">–</p>}
    </>
  );
}

function ResearchTaskContent(item: ItemRow, data: ItemData, editable: boolean) {
  return (
    <>
      {data.needsWeb && <p className="result-error">Needs web research: research runs it only with web access on (its Config page).</p>}
      {!editable && <Section title="Question" text={item.body} />}
      {!editable && <Section title="Goal" text={data.goal ?? data.why} />}
      {data.needsWeb && <Bullets title="Suggested sources" items={data.sources} />}
      <p className="muted">Depth {data.depth ?? 1} · attempts {item.attempts}</p>
    </>
  );
}

// The Autotest agent's report (TR): analysis, plan and, later, verdicts, written as markdown by renderTestReport.
function TestReportContent(item: ItemRow) {
  return item.body ? <MarkdownBlock text={item.body} /> : <p className="muted">–</p>;
}

function ResearchResultContent(item: ItemRow, data: ItemData) {
  return (
    <>
      <Section title="Conclusion" text={item.body} />
      <p>Confidence: <strong>{data.confidence ?? "–"}</strong></p>
      <Bullets title="Findings" items={data.findings} />
      <Bullets title="Evidence" items={data.evidence?.map((entry) => `${entry.location}: ${entry.note}`)} />
      <Bullets title="For design: docs" items={data.relevantDocs?.map((doc) => `${doc.path}: ${doc.why}`)} />
      <Bullets title="For design: code" items={data.codeRefs?.map((ref) => `${ref.location}: ${ref.why}`)} />
    </>
  );
}

function FindingContent(item: ItemRow, data: ItemData) {
  return (
    <>
      <p>{data.type === "issue" ? "Known issue" : "Open question"} for <strong>{data.project ?? "–"}</strong></p>
      <Section title={data.type === "issue" ? "Issue" : "Question"} text={item.body} />
      <Bullets title="Default" items={data.default} />
      <Bullets title="Options" items={data.options} />
    </>
  );
}

function DocsTaskContent(_item: ItemRow, data: ItemData) {
  return (
    <>
      <h2>Draft</h2>
      <p><code>{data.path ?? data.draft ?? "–"}</code> → {data.project ?? "–"}{data.target ? ` (${data.target})` : ""}</p>
      <p className="muted">Captured {data.captured ?? "–"} · source: {data.source ?? "–"}</p>
    </>
  );
}

function Section({ title, text }: { title: string; text: string | null | undefined }) {
  return (
    <>
      <h2>{title}</h2>
      {text ? <div className="text-block"><PbiLinkedText text={text} /></div> : <p className="muted">–</p>}
    </>
  );
}

function Bullets({ title, items }: { title: string; items: string[] | undefined }) {
  return (
    <>
      <h2>{title}</h2>
      {items && items.length > 0 ? <ul>{items.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p className="muted">None.</p>}
    </>
  );
}
