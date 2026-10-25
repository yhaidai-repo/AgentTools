import { listVaultTaskSchedules } from "@powerloom/core";
import { listTrash } from "@powerloom/vault";
import type { ReactNode } from "react";
import { Pager } from "@/components/Pager";
import { getDb } from "@/lib/db";
import { REGISTERS, registerRows, wwwRows, type RegisterKey } from "@/lib/registerRows";
import { readVaultRegisters } from "@/lib/vaultRegisters";
import { vaultUrl } from "@/lib/vaultUrl";
import type { RegisterRow } from "@/models/RegisterRow";
import { ScheduleTable } from "../tasks/ScheduleTable";
import { ImportFolderChat } from "./ImportFolderChat";
import { RegisterFilters } from "./RegisterFilters";
import { RegisterTable } from "./RegisterTable";
import { TrashTable } from "./TrashTable";

const PAGE_SIZES = [25, 50, 100];

type MaintenanceParams = { register?: string; show?: string; page?: string; size?: string };

// The vault's maintenance (user decision 2026-10-05): the jobs that keep it current, importing a folder of the PC, then
// one register at a time (user decision 2026-10-18: a switch instead of three long tables), open records first, and the
// trash.
export async function MaintenanceTab({ root, vault, params, tabs }: { root: string; vault: string; params: MaintenanceParams; tabs: ReactNode }) {
  const registers = await readVaultRegisters(root);
  const trash = await listTrash(root);
  const schedules = await listVaultTaskSchedules(getDb(), vault);
  const rowsByRegister: Record<RegisterKey, RegisterRow[]> = { www: wwwRows(registers.www), issues: registerRows(registers.issues), questions: registerRows(registers.questions) };
  const register = REGISTERS.find((choice) => choice.key === params.register)?.key ?? "www";
  const onlyOpen = params.show !== "all";
  const rows = rowsByRegister[register].filter((row) => !onlyOpen || row.isOpen);
  const size = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : PAGE_SIZES[0];
  const pages = Math.max(Math.ceil(rows.length / size), 1);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);

  return (
    <>
      <div className="tab-bar">{tabs}</div>
      <div className="section-label">Maintenance jobs</div>
      <ScheduleTable schedules={schedules} />
      <p className="hint">Tasks → New task (type vault-review, with a cron) schedules the vault review. The drafts job (every 10 min) gives each draft a tech-writer task.</p>
      <div className="section-label">Import</div>
      <ImportFolderChat vault={vault} />
      <RegisterFilters register={register} onlyOpen={onlyOpen} rowsByRegister={rowsByRegister} />
      <RegisterTable vault={vault} rows={rows.slice((page - 1) * size, page * size)} onlyOpen={onlyOpen} />
      {rows.length > size && <Pager page={page} size={size} sizes={PAGE_SIZES} pages={pages} total={rows.length} noun="records" hrefOf={(change) => vaultUrl({ tab: "maintenance", register, show: onlyOpen ? "open" : "all", page: change.page, size: change.size ?? size })} />}
      <Trash entries={trash} />
    </>
  );
}

// Notes the vault review removed (.trash/): a quiet line while it's empty.
function Trash({ entries }: { entries: Awaited<ReturnType<typeof listTrash>> }) {
  if (entries.length === 0) {
    return <p className="quiet-line">The trash is empty: notes the vault review removes land here, to restore or delete for good.</p>;
  }

  return (
    <>
      <div className="section-label">Trash</div>
      <TrashTable rows={entries.map((entry) => ({ path: entry.path, sizeBytes: entry.sizeBytes, modifiedAt: entry.modifiedAt.toISOString() }))} />
    </>
  );
}
