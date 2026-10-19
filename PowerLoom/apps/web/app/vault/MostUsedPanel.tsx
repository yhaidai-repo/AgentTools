import { AgentDots } from "@/components/AgentDots";
import { Panel } from "@/components/Panel";
import { BarLegend, StackedBar } from "@/components/StackedBar";
import { TimeAgo } from "@/components/TimeAgo";
import type { BarPart } from "@/models/BarPart";
import type { NoteUsage } from "@/models/NoteUsage";
import { DocLink } from "./DocLink";
import { agentLabel } from "./UsageFilters";

const USE_KINDS: Pick<BarPart, "label" | "className">[] = [
  { label: "reads", className: "use-read" },
  { label: "searches", className: "use-search" },
  { label: "shell", className: "use-shell" },
  { label: "writes", className: "use-write" },
];

// The notes used most in the period by the chosen agent: one stacked bar of reads, searches, shell uses and writes, and
// the agents as dots (user decision 2026-10-18), instead of seven columns.
export function MostUsedPanel({ vault, rows, palette, agent }: { vault: string; rows: NoteUsage[]; palette: string[]; agent: string }) {
  return (
    <Panel title={<span>Most used <small>by {agentLabel(agent).toLowerCase()}</small></span>} aside={<BarLegend parts={USE_KINDS} />} table>
      {rows.length === 0 ? <p className="panel-body hint">No note was used in the period.</p> : (
        <table className="data-table vault-table">
          <thead>
            <tr><th>Note</th><th className="col-uses" title="Shell: named in a shell command, Claude Code's usual way to read a note (sometimes only a mention)">Uses</th><th className="col-when num">Last used</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.path}>
                <td className="title">
                  <DocLink vault={vault} path={row.path}>{row.title}</DocLink>
                  <span className="note-path">{row.path}</span>
                  <div className="row-facts"><AgentDots agents={row.agents} palette={palette} /></div>
                </td>
                <td className="col-uses"><StackedBar parts={partsOf(row)} /></td>
                <td className="col-when num"><TimeAgo date={row.lastUsed} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function partsOf(row: NoteUsage): BarPart[] {
  const counts = [row.reads, row.searches, row.shell, row.writes];

  return USE_KINDS.map((kind, index) => ({ ...kind, value: counts[index] }));
}
