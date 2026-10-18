import Link from "next/link";
import { SegLinks } from "@/components/SegLinks";
import { dayRangeOptions } from "@/lib/ranges";
import { kindTag, type TaskBucket } from "@/lib/taskLooks";
import { UPDATED_FIRST, tasksUrl } from "@/lib/tasksUrl";
import type { TaskFilter } from "@/models/TaskFilter";
import { PbiFilterField } from "./PbiFilterField";

// "For you" leads the row, before All: it is what the page is for.
const BUCKETS: { key: TaskBucket; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "held", label: "Held" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

interface TaskFiltersProps {
  filter: TaskFilter;
  total: number;
  buckets: Map<string, number>;
  kinds: Map<string, number>;
}

// The filters as pills with counts (user decision 2026-10-18): what the task waits for (For you first), its kind, the
// period, and the PBI. Everything lives in the URL; a change goes back to page 1.
export function TaskFilters({ filter, total, buckets, kinds }: TaskFiltersProps) {
  const keep = { kind: filter.kind, pbi: filter.pbi, range: filter.range, youFirst: filter.youFirst, size: filter.size };

  return (
    <>
      <div className="backlog-bar">
        <nav className="status-pills" aria-label="Filter by status">
          {buckets.has("you") && <Pill href={tasksUrl({ ...keep, status: "you" })} on={filter.status === "you"} label="For you" count={buckets.get("you")} warm />}
          <Pill href={tasksUrl({ ...keep, status: "all" })} on={filter.status === "all"} label="All" count={total} />
          {BUCKETS.filter((bucket) => buckets.has(bucket.key)).map((bucket) => <Pill key={bucket.key} href={tasksUrl({ ...keep, status: bucket.key })} on={filter.status === bucket.key} label={bucket.label} count={buckets.get(bucket.key) ?? 0} />)}
        </nav>
        <span className="sync-line">
          <SortToggle filter={filter} />
          <SegLinks name="range" value={filter.range} options={dayRangeOptions()} path="/tasks" keep={{ status: filter.status, kind: filter.kind, pbi: filter.pbi, sort: filter.youFirst ? "" : UPDATED_FIRST }} />
        </span>
      </div>
      <div className="backlog-bar">
        <nav className="status-pills" aria-label="Filter by kind">
          <Pill href={tasksUrl({ ...keep, status: filter.status, kind: "" })} on={filter.kind === ""} label="All kinds" />
          {[...kinds.keys()].map((kind) => <Pill key={kind} href={tasksUrl({ ...keep, status: filter.status, kind })} on={filter.kind === kind} label={kindTag(kind).label} count={kinds.get(kind)} />)}
        </nav>
        <PbiFilterField filter={filter} />
      </div>
    </>
  );
}

// Waits on you first, or simply the latest change first (user request 2026-10-18); a click flips it.
function SortToggle({ filter }: { filter: TaskFilter }) {
  return (
    <Link href={tasksUrl({ ...filter, page: 1, youFirst: !filter.youFirst })} className={`sort-toggle${filter.youFirst ? " on" : ""}`} role="switch" aria-checked={filter.youFirst} title={filter.youFirst ? "What waits on you is on top; click to sort by the latest change only" : "Sorted by the latest change; click to put what waits on you on top"}>
      <span className="switch-knob" aria-hidden="true" />
      Waits on you first
    </Link>
  );
}

function Pill({ href, on, label, count, warm = false }: { href: string; on: boolean; label: string; count?: number; warm?: boolean }) {
  const classes = ["status-pill", on ? "on" : "", warm ? "for-you-pill" : ""].filter(Boolean).join(" ");

  return <Link href={href} className={classes}>{label}{count !== undefined && <b>{count}</b>}</Link>;
}
