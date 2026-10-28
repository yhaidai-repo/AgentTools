import { TimeAgo } from "@/components/TimeAgo";
import type { RegisterRow } from "@/models/RegisterRow";
import { DocLink } from "./DocLink";
import { RecordWorkItems } from "./RecordWorkItems";

// One register in four columns that fit (user decision 2026-10-18): the record with its project (ids repeat across
// projects), the title with its facts under it, the status, and when. An open miss pulses amber; open issues and
// questions stay calm; resolved is teal like done.
export function RegisterTable({ vault, rows, onlyOpen }: { vault: string; rows: RegisterRow[]; onlyOpen: boolean }) {
  if (rows.length === 0) {
    return <p className="quiet-line">{onlyOpen ? "Nothing open in this register." : "This register has no record."}</p>;
  }

  return (
    <div className="panel">
      <table className="data-table vault-table register-table">
        <thead>
          <tr><th className="col-record">Record</th><th>Title</th><th className="col-status">Status</th><th className="col-when num">Date</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.isOpen ? undefined : "settled"}>
              <td className="col-record"><DocLink vault={vault} path={row.path}><span className="id">{row.id}</span></DocLink><span className="project-tag">{row.project}</span></td>
              <td className="title">
                <span className="register-title">{row.title}</span>
                <RecordWorkItems references={row.workItems} />
                {row.facts.length > 0 && <div className="row-facts">{row.facts.map((fact) => <span key={fact} className={faultClass(fact)}>{fact}</span>)}</div>}
              </td>
              <td className="col-status"><span className={`register-status ${statusClass(row)}`}>{row.status}</span></td>
              <td className="col-when num"><TimeAgo date={row.date} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusClass(row: RegisterRow): string {
  if (row.needsAttention) {
    return "attention";
  }

  return row.isOpen ? "open" : "resolved";
}

// An agent's fault in violet, a person's in warm (user decision 2026-10-18).
function faultClass(fact: string): string | undefined {
  if (fact === "fault: Agent") {
    return "fault-agent";
  }

  return fact === "fault: Human" ? "fault-human" : undefined;
}
