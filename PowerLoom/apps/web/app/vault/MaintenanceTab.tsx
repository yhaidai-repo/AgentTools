import { VAULT_REVIEW_AGENT, listVaultTaskSchedules, type TaskSchedule } from "@powerloom/core";
import { listTrash, type WwwRecord } from "@powerloom/vault";
import { getDb } from "@/lib/db";
import { WWW_LOG_PATH, isOpenWww, readVaultRegisters } from "@/lib/vaultRegisters";
import type { ProjectRegisterRecord } from "@/models/ProjectRegisterRecord";
import { ScheduleTable } from "../tasks/ScheduleTable";
import { AddVaultReviewButton } from "./AddVaultReviewButton";
import { TrashTable } from "./TrashTable";
import { DocLink } from "./DocLink";

// The vault's maintenance (user decision 2026-10-05): the jobs that keep it current, and its What-went-wrong records,
// known issues and open questions, read from the vault's own notes (open records first).
export async function MaintenanceTab({ root, vault }: { root: string; vault: string }) {
  const registers = await readVaultRegisters(root);
  const trash = await listTrash(root);
  const schedules = await listVaultTaskSchedules(getDb(), vault);

  return (
    <>
      <h2>Maintenance jobs</h2>
      <p className="muted">The scheduled tasks of <code>{vault}</code>. The drafts job (every 10 min) gives each draft a tech-writer task.</p>
      <VaultSchedules schedules={schedules} />
      {!schedules.some((schedule) => schedule.agentId === VAULT_REVIEW_AGENT) && <AddVaultReviewButton />}
      <h2>What went wrong ({openCount(registers.www.filter(isOpenWww).length, registers.www.length)})</h2>
      <WwwRecords vault={vault} records={registers.www} />
      <h2>Known issues ({openCount(unresolved(registers.issues), registers.issues.length)})</h2>
      <RegisterRecords vault={vault} records={registers.issues} empty="No known issue is recorded in the vault's projects." />
      <h2>Open questions ({openCount(unresolved(registers.questions), registers.questions.length)})</h2>
      <RegisterRecords vault={vault} records={registers.questions} empty="No open question is recorded in the vault's projects." />
      <h2>Trash ({trash.length})</h2>
      <p className="muted">Notes the vault review removed (<code>.trash/</code>): put one back, or delete it for good.</p>
      {trash.length === 0 ? <p className="muted">The trash is empty.</p> : <TrashTable rows={trash.map((entry) => ({ path: entry.path, sizeBytes: entry.sizeBytes, modifiedAt: entry.modifiedAt.toISOString() }))} />}
    </>
  );
}

function unresolved(records: ProjectRegisterRecord[]): number {
  return records.filter((record) => !record.resolved).length;
}

function openCount(open: number, total: number): string {
  return `${open} open of ${total}`;
}

function VaultSchedules({ schedules }: { schedules: TaskSchedule[] }) {
  if (schedules.length === 0) {
    return <p className="muted">No scheduled task for this vault yet.</p>;
  }

  return <ScheduleTable schedules={schedules} />;
}

function WwwRecords({ vault, records }: { vault: string; records: WwwRecord[] }) {
  if (records.length === 0) {
    return <p className="muted">The vault&apos;s {WWW_LOG_PATH} has no record.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Record</th><th>Title</th><th>Kind</th><th>Project</th><th>Fault</th><th>Status</th><th>Created</th></tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td><DocLink vault={vault} path={WWW_LOG_PATH}>{record.id}</DocLink></td>
              <td className="title">{record.title}</td>
              <td>{record.kind}</td>
              <td>{record.project}</td>
              <td>{record.fault}</td>
              <td><StatusChip open={isOpenWww(record)} status={record.status} /></td>
              <td>{record.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegisterRecords({ vault, records, empty }: { vault: string; records: ProjectRegisterRecord[]; empty: string }) {
  if (records.length === 0) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Record</th><th>Title</th><th>Project</th><th>Status</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.project}-${record.id}`}>
              <td><DocLink vault={vault} path={record.path}>{record.id}</DocLink></td>
              <td className="title">{record.title}</td>
              <td>{record.project}</td>
              <td><StatusChip open={!record.resolved} status={record.status || (record.resolved ? "Resolved" : "Open")} /></td>
              <td>{record.updated ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ open, status }: { open: boolean; status: string }) {
  return <span className={open ? "chip" : "chip result-ok"}>{status}</span>;
}
