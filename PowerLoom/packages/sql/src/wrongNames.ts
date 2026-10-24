import type { SqlServerError } from "./models/SqlServerError";
import type { WrongName } from "./models/WrongName";

// SQL Server's errors for a name it doesn't know, with where the name sits in the message. Agents guess names from
// the C# entities, and the mappings rename them (Facility.Id is FacilityId, Tenant lives in the membership schema).
const WRONG_NAME_PATTERNS: { number: number; kind: WrongName["kind"]; pattern: RegExp }[] = [
  { number: 207, kind: "column", pattern: /Invalid column name '([^']+)'/i },
  { number: 208, kind: "table", pattern: /Invalid object name '([^']+)'/i },
  { number: 209, kind: "ambiguous", pattern: /Ambiguous column name '([^']+)'/i },
  { number: 4104, kind: "unbound", pattern: /multi-part identifier "([^"]+)" could not be bound/i },
];

export function isWrongNameError(errors: SqlServerError[]): boolean {
  return errors.some((error) => WRONG_NAME_PATTERNS.some((entry) => entry.number === error.number));
}

// Each wrong name once, in the order the server reported them.
export function wrongNamesOf(errors: SqlServerError[]): WrongName[] {
  const names = errors.flatMap(wrongNameOf);

  return names.filter((name, index) => names.findIndex((other) => other.kind === name.kind && other.name.toLowerCase() === name.name.toLowerCase()) === index);
}

function wrongNameOf(error: SqlServerError): WrongName[] {
  const entry = WRONG_NAME_PATTERNS.find((candidate) => candidate.number === error.number);
  const match = entry?.pattern.exec(error.message);

  return entry && match ? [{ kind: entry.kind, name: match[1] }] : [];
}

// "v.FacilityId" → ["v", "FacilityId"]; the qualifier keeps a schema ("dbo.Facility.Id" → ["dbo.Facility", "Id"]).
export function qualifiedParts(name: string): [string, string] {
  const dot = name.lastIndexOf(".");

  return dot < 0 ? ["", name] : [name.slice(0, dot), name.slice(dot + 1)];
}
