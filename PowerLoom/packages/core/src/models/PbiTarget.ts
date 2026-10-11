// Where a new PBI goes: its vault and, for a child item, its parent.
export interface PbiTarget {
  vault: string;
  parentId: number | null;
}
