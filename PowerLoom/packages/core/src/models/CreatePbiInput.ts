// What pbi.create takes: the vault may be left out for a child item, which goes to its parent's vault.
export interface CreatePbiInput {
  vault?: string;
  title: string;
  type: string;
  priority: number;
  descriptionMd: string | null;
  acceptanceCriteriaMd: string | null;
  parentId: number | null;
}
