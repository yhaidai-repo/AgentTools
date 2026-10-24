// What pbi.list keeps of the Backlog rows: a pipeline status, and a substring of the title or the id (both optional).
export interface BacklogListFilter {
  status?: string;
  search?: string;
}
