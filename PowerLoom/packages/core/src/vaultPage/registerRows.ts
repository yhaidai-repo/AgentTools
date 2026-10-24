import type { WwwRecord } from "@powerloom/vault";
import type { ProjectRegisterRecord } from "../models/ProjectRegisterRecord";
import type { RegisterRow } from "../models/RegisterRow";
import { WWW_LOG_PATH, isOpenWww } from "./vaultRegisters";

export const REGISTERS = [
  { key: "www", label: "What went wrong" },
  { key: "issues", label: "Known issues" },
  { key: "questions", label: "Open questions" },
] as const;

export type RegisterKey = (typeof REGISTERS)[number]["key"];

export function wwwRows(records: WwwRecord[]): RegisterRow[] {
  return records.map((record) => ({
    key: record.id,
    id: record.id,
    project: record.project,
    title: record.title,
    path: WWW_LOG_PATH,
    facts: [record.kind, `fault: ${record.fault}`],
    status: record.status,
    isOpen: isOpenWww(record),
    needsAttention: isOpenWww(record),
    date: record.created,
  }));
}

export function registerRows(records: ProjectRegisterRecord[]): RegisterRow[] {
  return records.map((record) => ({
    key: `${record.project}-${record.id}`,
    id: record.id,
    project: record.project,
    title: record.title,
    path: record.path,
    facts: [],
    status: record.status || (record.resolved ? "Resolved" : "Open"),
    isOpen: !record.resolved,
    needsAttention: false,
    date: record.updated,
  }));
}
