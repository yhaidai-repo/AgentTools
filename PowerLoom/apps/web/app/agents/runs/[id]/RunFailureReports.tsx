import { runFailureReport, type FailureImpact } from "@powerloom/db";
import { asc, eq } from "drizzle-orm";
import { Panel } from "@/components/Panel";
import { getDb } from "@/lib/db";

const SERIOUS: FailureImpact[] = ["gap_in_result", "blocked"];

// What the agent says went wrong in this run and what it did about it (report_failure). A claim by the agent: the data
// access log shows the failed calls themselves.
export async function RunFailureReports({ runId }: { runId: number }) {
  const reports = await getDb().select().from(runFailureReport).where(eq(runFailureReport.runId, runId)).orderBy(asc(runFailureReport.id));

  if (reports.length === 0) {
    return null;
  }

  return (
    <Panel title={<span>Reported problems <small>by the agent</small></span>}>
      <div className="item-rows">
        {reports.map((report) => (
          <div key={report.id} className="item-row">
            <span className={SERIOUS.includes(report.impact) ? "dot error" : "dot ok"} />
            <span className="item-title">
              {report.tool ? `${report.tool} · ` : ""}{report.target}: {report.saw}
              <span className="file-meta">{report.kind} → {report.workaround}{report.instead ? ` (${report.instead})` : ""}</span>
            </span>
            <span className="item-state">{report.impact}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
