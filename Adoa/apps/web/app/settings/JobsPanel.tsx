import { JOB_CATALOG } from "@adoa/core";
import { LocalTime } from "@/components/LocalTime";
import { loadJobStates } from "@/lib/jobStates";

// Every job, the worker that runs it, what triggers it and what it does (user decision 2026-10-06), with what each queue
// is doing now.
export async function JobsPanel() {
  const states = await loadJobStates();

  return (
    <>
      <p className="muted">
        Two workers: <code>worker</code> (sync, imports, notes, dispatch, maintenance) and <code>agent-runner</code> (the agents&apos; runs, with the Claude token).
        The web only sends jobs. Failed jobs are listed on the Agents page under Job errors.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Job</th><th>Worker</th><th>Triggered by</th><th>Does</th><th>Waiting</th><th>Running</th><th>Last completed</th></tr>
          </thead>
          <tbody>
            {JOB_CATALOG.map((job) => (
              <tr key={job.queue}>
                <td><code>{job.queue}</code></td>
                <td>{job.worker}</td>
                <td>{job.trigger}</td>
                <td>{job.purpose}</td>
                <td>{states.get(job.queue)?.waiting ?? 0}</td>
                <td>{states.get(job.queue)?.running ?? 0}</td>
                <td><LocalTime date={states.get(job.queue)?.lastCompleted ?? null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
