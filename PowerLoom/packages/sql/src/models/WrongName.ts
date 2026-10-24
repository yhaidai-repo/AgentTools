/**
 * A name SQL Server rejected, taken from its error: `column` = Invalid column name (207), `table` = Invalid object name
 * (208), `ambiguous` = Ambiguous column name (209), `unbound` = a multi-part identifier that could not be bound (4104,
 * e.g. `v.FacilityId` with no `v` in the FROM).
 */
export interface WrongName {
  kind: "column" | "table" | "ambiguous" | "unbound";
  name: string;
}
