import type { workItem } from "@adoa/db";
import type { BugInfo } from "./BugInfo";
import type { ChildItem } from "./ChildItem";

type WorkItemRow = typeof workItem.$inferSelect;

// A PBI as `pbi.get` returns it: its fields, parent, child items, bug record, repos and skills.
export type PbiOverview = Pick<WorkItemRow, "adoId" | "title" | "type" | "source" | "vault" | "adoState" | "pipelineStatus" | "descriptionMd" | "acceptanceCriteriaMd"> & {
  adoUrl: string | null;
  notePath: string | null; // relative to the vault's backlog folder in adoa's backlog vault
  parent: { adoId: number; title: string } | null;
  children: ChildItem[];
  bug: BugInfo | null;
  repos: string[];
  skills: string[];
};
