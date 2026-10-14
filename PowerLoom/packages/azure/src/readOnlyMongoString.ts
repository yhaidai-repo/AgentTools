import type { ArmConnectionString } from "./models/ArmConnectionString";

// The read-only MongoDB connection string among an account's strings: the primary read-only one first, else any
// read-only one; null when the account has none (then it isn't a Cosmos DB for MongoDB account).
export function readOnlyMongoString(strings: ArmConnectionString[]): string | null {
  const readOnly = strings.filter(isMongo).filter(isReadOnly);
  const primary = readOnly.find((entry) => /primary/i.test(entry.keyKind ?? entry.description ?? ""));

  return (primary ?? readOnly[0])?.connectionString ?? null;
}

function isMongo(entry: ArmConnectionString): boolean {
  return entry.connectionString.startsWith("mongodb");
}

function isReadOnly(entry: ArmConnectionString): boolean {
  return /readonly/i.test(entry.keyKind ?? "") || /read-?only/i.test(entry.description ?? "");
}
