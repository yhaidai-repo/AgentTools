import { workItemUrl, type AdoSettings } from "@adoa/core";
import Link from "next/link";
import type { BacklogGroup } from "@/models/BacklogGroup";
import type { BacklogRow } from "@/models/BacklogRow";
import { ChildToggle } from "./ChildToggle";

const BUG_SOURCES: Record<string, string> = { ado: "bug · QA", internal: "bug · reported" };

// Checkboxes post `adoId` values with the surrounding BacklogForm. Each PBI and its child items are one tbody, so the
// toggle can fold the children (user decision 2026-10-09).
export function PbiTable({ groups, ado }: { groups: BacklogGroup[]; ado: AdoSettings | null }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th aria-label="Select" />
            <th>ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Priority</th>
            <th>ADO state</th>
            <th>Pipeline</th>
            <th>Sprint</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.parent.adoId} className="pbi-group">
            <PbiRow row={group.parent} ado={ado} className={group.parentMatches ? undefined : "context-row"} toggle={group.children.length > 0 && <ChildToggle count={group.children.length} />} />
            {group.children.map((child) => <PbiRow key={child.adoId} row={child} ado={ado} className="child-row" />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function PbiRow({ row, ado, className, toggle }: { row: BacklogRow; ado: AdoSettings | null; className?: string; toggle?: React.ReactNode }) {
  return (
    <tr className={className}>
      <td>
        <input type="checkbox" name="adoId" value={row.adoId} data-title={row.title} aria-label={`Select ${row.adoId}`} />
      </td>
      <td><PbiId row={row} ado={ado} /></td>
      <td className="title">
        <Link href={`/pbis/${row.adoId}`}>{row.title}</Link>
        {row.bugSource && <span className="chip">{BUG_SOURCES[row.bugSource]}</span>}
        {toggle}
      </td>
      <td>{row.type}</td>
      <td>{row.priority ?? "–"}</td>
      <td>{row.adoState}</td>
      <td>{row.pipelineStatus}<NeedsAction row={row} /></td>
      <td>{row.iterationPath}</td>
    </tr>
  );
}

// Red only for what holds the agents back; findings to review are a quiet note (same split as the PBI page).
// The ADO link, or the id with "local" for a PBI created in adoa.
function PbiId({ row, ado }: { row: BacklogRow; ado: AdoSettings | null }) {
  const url = workItemUrl(ado, row);

  return url ? <a href={url} target="_blank" rel="noreferrer">{row.adoId}</a> : <>{row.adoId}{row.source === "local" && <span className="muted"> local</span>}</>;
}

function NeedsAction({ row }: { row: BacklogRow }) {
  return (
    <>
      {row.openForYou > 0 && <> · <Link href={`/pbis/${row.adoId}`} className="result-error">needs your action ({row.openForYou})</Link></>}
      {row.findingsToReview > 0 && <> · <Link href={`/pbis/${row.adoId}`} className="muted">{row.findingsToReview} finding{row.findingsToReview === 1 ? "" : "s"} to review</Link></>}
    </>
  );
}
