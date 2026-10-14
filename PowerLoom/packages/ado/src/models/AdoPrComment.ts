// One comment of a PR thread. `type` is ADO's commentType: "text" from a person, "system" from ADO itself
// (votes, pushes), "codeChange" for a suggestion.
export interface AdoPrComment {
  id: number;
  parentId: number;
  author: string | null;
  createdAt: string | null;
  type: string;
  content: string;
  isDeleted: boolean;
}
