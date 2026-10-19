import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import { vaultUrl } from "@/lib/vaultUrl";
import type { NoteUsage } from "@/models/NoteUsage";
import { DocLink } from "./DocLink";

// The unused notes are most of a vault, so the list shows the first ones until asked for all (user decision 2026-10-05);
// the panel starts folded, quieter than the rest (user decision 2026-10-18).
const NOT_USED = 20;

export function NotUsedPanel({ vault, rows, showAll, keep }: { vault: string; rows: NoteUsage[]; showAll: boolean; keep: Record<string, string> }) {
  const shown = showAll ? rows : rows.slice(0, NOT_USED);

  return (
    <details className="panel fold-panel" open={showAll}>
      <summary><span className="fold-mark" aria-hidden="true">›</span>Not used in the period <small>oldest first</small><span className="fold-count">{rows.length}</span></summary>
      {rows.length === 0 ? <p className="panel-body hint">Every note was used in the period.</p> : (
        <table className="data-table vault-table">
          <thead>
            <tr><th>Note</th><th className="col-when num">Last used</th></tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.path}>
                <td className="title"><DocLink vault={vault} path={row.path}>{row.title}</DocLink><span className="note-path">{row.path}</span></td>
                <td className="col-when num">{row.lastUsed ? <TimeAgo date={row.lastUsed} /> : <span className="muted">never</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!showAll && rows.length > NOT_USED && <p className="panel-body hint">The first {NOT_USED} of {rows.length}. <Link href={vaultUrl({ ...keep, unused: "all" })}>Show all</Link></p>}
    </details>
  );
}
