// A work item read with `$expand=relations`: only its links are used.
export interface WorkItemRelationsDto {
  relations?: { rel: string; url: string }[];
}
