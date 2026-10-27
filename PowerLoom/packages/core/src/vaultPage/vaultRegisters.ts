import { containedPath, parseRegisterRecords, parseWwwRecords, type WwwRecord } from "@powerloom/vault";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectRegisterRecord } from "../models/ProjectRegisterRecord";
import type { VaultRegisters } from "../models/VaultRegisters";

export const WWW_LOG_PATH = "www-log.md";

const ISSUES_SUFFIX = "known-issues";
const QUESTIONS_SUFFIX = "open-questions";
const OPEN_WWW_STATUS = "open";

// The vault's WWW log and each project's registers (`<key>/<key>-known-issues.md`, `<key>/<key>-open-questions.md`),
// open records first, then the latest change first. Feature-local question files aren't registers and are left out.
export async function readVaultRegisters(root: string): Promise<VaultRegisters> {
  const projects = await projectFolders(root);
  const issues = await Promise.all(projects.map((project) => readRegister(root, project, ISSUES_SUFFIX)));
  const questions = await Promise.all(projects.map((project) => readRegister(root, project, QUESTIONS_SUFFIX)));

  return { www: await readWwwLog(root), issues: openFirst(issues.flat()), questions: openFirst(questions.flat()) };
}

export function isOpenWww(record: WwwRecord): boolean {
  return record.status.toLowerCase() === OPEN_WWW_STATUS;
}

async function projectFolders(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });

  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
}

async function readRegister(root: string, project: string, suffix: string): Promise<ProjectRegisterRecord[]> {
  const path = `${project}/${project}-${suffix}.md`;
  const text = await readNoteOrEmpty(root, path);

  return parseRegisterRecords(text).map((record) => ({ ...record, project, path }));
}

async function readWwwLog(root: string): Promise<WwwRecord[]> {
  const records = parseWwwRecords(await readNoteOrEmpty(root, WWW_LOG_PATH));

  return records.sort((a, b) => Number(isOpenWww(b)) - Number(isOpenWww(a)) || b.updated.localeCompare(a.updated));
}

// A vault without the log, or a project without a register, simply has no records.
async function readNoteOrEmpty(root: string, path: string): Promise<string> {
  const safe = await containedPath(root, join(root, path));
  return safe ? readFile(safe, "utf8").catch(() => "") : "";
}

function openFirst(records: ProjectRegisterRecord[]): ProjectRegisterRecord[] {
  return records.sort((a, b) => Number(a.resolved) - Number(b.resolved) || (b.updated ?? "").localeCompare(a.updated ?? ""));
}
