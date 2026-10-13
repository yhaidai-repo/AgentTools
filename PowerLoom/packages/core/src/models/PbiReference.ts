// Something related to a PBI that the context lists by reference: read_pbi(ref) returns all of it.
export interface PbiReference {
  ref: string;
  kind: string;
  status: string;
  title: string;
}
