import { isSettledPbi, workItemUrl, type AdoSettings } from "@powerloom/core";
import Link from "next/link";
import { AdoTag } from "@/components/AdoTag";
import { PipelinePill } from "@/components/PipelinePill";
import { SelectAll } from "@/components/SelectAll";
import { TimeAgo } from "@/components/TimeAgo";
import { TypeTag } from "@/components/TypeTag";
import { groupChangedAt } from "@/lib/backlogGroups";
import { holds } from "@/lib/backlogPages";
import { sprintName } from "@/lib/sprintProgress";
import type { BacklogGroup } from "@/models/BacklogGroup";
import type { BacklogRow } from "@/models/BacklogRow";
import { ChildToggle, GroupBody } from "./GroupBody";

// Four data columns that always fit (user, 2026-10-18: no sideways scroll): the facts of a PBI go on one quiet line
// under its title. Checkboxes post `adoId` values with the surrounding BacklogForm. Each PBI and its child items are one
// tbody, so its children fold (user decision 2026-10-09).
// The PBI you came back to (`focus`) opens its group even when it would start folded.
export function PbiTable({ groups, ado, focus }: { groups: BacklogGroup[]; ado: AdoSettings | null; focus: number | null }) {
  return (
    <div className="panel pbi-table">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-select"><SelectAll name="adoId" /></th>
            <th className="col-fold" aria-label="Child items" />
            <th className="col-id">ID</th>
            <th>PBI</th>
            <th className="col-stage">Pipeline</th>
            <th className="col-updated num">Updated</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <GroupBody key={group.parent.adoId} startFolded={startsFolded(group, focus)}>
            <PbiRow row={group.parent} ado={ado} changedAt={groupChangedAt(group)} group={group} />
            {group.children.map((child, index) => <PbiRow key={child.adoId} row={child} ado={ado} changedAt={child.changedAt} parent={group.parent} isLast={index === group.children.length - 1} />)}
          </GroupBody>
        ))}
      </table>
    </div>
  );
}

// A done or closed PBI's children start folded, unless one of them is what you came back to.
function startsFolded(group: BacklogGroup, focus: number | null): boolean {
  return isSettledPbi(group.parent.pipelineStatus) && group.parentMatches && (focus === null || !holds(group, focus));
}

interface PbiRowProps {
  row: BacklogRow;
  ado: AdoSettings | null;
  changedAt: Date;
  /** Set on a parent row: its group. */
  group?: BacklogGroup;
  /** Set on a child row: its parent. */
  parent?: BacklogRow;
  isLast?: boolean;
}

// A settled PBI (done, closed) is dimmed so the active ones stand out; a child sits on the group's tree line.
function PbiRow({ row, ado, changedAt, group, parent, isLast = false }: PbiRowProps) {
  const classes = [isSettledPbi(row.pipelineStatus) ? "settled" : "", parent ? "child-row" : "", isLast ? "last" : "", group && !group.parentMatches ? "context-row" : ""].filter(Boolean).join(" ");

  return (
    <tr className={classes || undefined} id={`pbi-${row.adoId}`}>
      <td className="col-select"><input type="checkbox" name="adoId" value={row.adoId} data-title={row.title} aria-label={`Select ${row.adoId}`} /></td>
      <td className="col-fold">{group && group.children.length > 0 && <ChildToggle count={group.children.length} />}</td>
      <td className="col-id"><span className="id">{row.adoId}</span><AdoTag url={workItemUrl(ado, row)} /></td>
      <td className="title">
        <Link href={`/pbis/${row.adoId}`} className="row-title" title={row.title}>{row.title}</Link>
        <RowFacts row={row} parent={parent} group={group} />
      </td>
      <td className="col-stage"><PipelinePill status={row.pipelineStatus} /><ForYou row={row} /></td>
      <td className="col-updated num"><TimeAgo date={changedAt} /></td>
    </tr>
  );
}

// Type, ADO state, sprint and priority; a child's sprint reads "same" when it is its parent's. A parent tells its
// children and how many wait for you, so folding never hides attention.
function RowFacts({ row, parent, group }: { row: BacklogRow; parent?: BacklogRow; group?: BacklogGroup }) {
  const sameSprint = parent && parent.iterationPath === row.iterationPath;

  return (
    <div className="row-facts">
      <TypeTag type={row.type} bugSource={row.bugSource} />
      {row.source === "ado" && <span title="ADO state">{row.adoState}</span>}
      {row.iterationPath && <span title="Sprint">{sameSprint ? "same sprint" : sprintName(row.iterationPath)}</span>}
      {row.priority !== null && <span className="mono" title="Priority">P{row.priority}</span>}
      {group && !group.parentMatches && <span className="context-tag">context</span>}
      {group && group.children.length > 0 && <ChildrenSummary group={group} />}
    </div>
  );
}

function ChildrenSummary({ group }: { group: BacklogGroup }) {
  const waiting = group.children.filter((child) => !isSettledPbi(child.pipelineStatus) && child.openForYou > 0).length;

  return (
    <span>
      {group.children.length} child {group.children.length === 1 ? "item" : "items"}
      {waiting > 0 && <span className="text-warn"> · {waiting} {waiting === 1 ? "needs" : "need"} you</span>}
    </span>
  );
}

// What waits on you holds the agents back: an amber badge with a pulsing dot; findings to review are a quiet note
// (same split as the PBI page). A settled PBI waits on nobody.
function ForYou({ row }: { row: BacklogRow }) {
  if (isSettledPbi(row.pipelineStatus)) {
    return null;
  }

  return (
    <>
      {row.openForYou > 0 && <Link href={`/pbis/${row.adoId}`} className="for-you">{row.openForYou} for you</Link>}
      {row.findingsToReview > 0 && <Link href={`/pbis/${row.adoId}`} className="findings-note">{row.findingsToReview} finding{row.findingsToReview === 1 ? "" : "s"}</Link>}
    </>
  );
}
