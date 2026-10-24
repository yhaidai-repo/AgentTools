// A work item read with `$expand=relations`: its fields and its links.
export interface WorkItemRelationsDto {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  relations?: { rel: string; url: string; attributes?: { name?: string; comment?: string } }[];
}
