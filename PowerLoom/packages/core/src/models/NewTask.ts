// A task the user creates for an agent type (the Tasks page's New task): PowerLoom checks it against its type.
export interface NewTask {
  vault: string;
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  /** The PBI as typed (id or ADO link); the types that need one refuse without it. */
  pbi: string | null;
  repos: string[];
}
