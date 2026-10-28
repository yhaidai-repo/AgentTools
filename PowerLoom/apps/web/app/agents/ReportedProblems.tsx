import type { FailureReportGroup } from "@powerloom/core";
import { AgentDots } from "@/components/AgentDots";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";

// What agents and chats reported about failures (report_failure, failure_report): the same cause in many runs is the
// top row. Their claims; the calls themselves are in the log below.
export function ReportedProblems({ groups, palette }: { groups: FailureReportGroup[]; palette: string[] }) {
  return (
    <Panel title={<span>Reported by agents <small>the most reported cause first · the failed calls are in the log below</small></span>} aside={<small>{groups.length}</small>} table>
      {groups.length === 0 ? <p className="panel-body hint">No problems reported in the period.</p> : <GroupTable groups={groups} palette={palette} />}
    </Panel>
  );
}

function GroupTable({ groups, palette }: { groups: FailureReportGroup[]; palette: string[] }) {
  return (
    <table className="data-table vault-table tools-table">
      <thead>
        <tr><th>Cause</th><th className="col-uses">Reports</th><th className="col-uses">Runs</th><th className="col-agents">Agents</th><th className="col-when num">Last reported</th></tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={`${group.kind}:${group.tool}:${group.target}`}>
            <td className="title"><span className="mono resource-name">{group.tool ? `${group.tool} · ` : ""}{group.target}</span><span className="note-path">{group.kind}</span></td>
            <td className="col-uses">{group.reports}</td>
            <td className="col-uses">{group.runs}</td>
            <td className="col-agents"><AgentDots agents={group.agents} palette={palette} /></td>
            <td className="col-when num"><TimeAgo date={group.lastReportedAt} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
