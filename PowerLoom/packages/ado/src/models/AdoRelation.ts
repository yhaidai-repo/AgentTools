// One link of a work item: another work item (url ends in its id), a pull request or commit (vstfs:///Git/...),
// a hyperlink or an attachment. `name` is ADO's label for the link type, e.g. "Parent", "Pull Request".
export interface AdoRelation {
  rel: string;
  url: string;
  name: string | null;
  comment: string | null;
}
