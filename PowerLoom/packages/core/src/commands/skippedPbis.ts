import type { PreparedPbis } from "../models/PreparedPbis";

// Why Start passed over some PBIs: closed ones (reopen first) and ones PowerLoom doesn't have.
export function skippedPbis(prepared: PreparedPbis): string[] {
  return [...prepared.closed.map((adoId) => `PBI-${adoId} is closed: reopen it first.`), ...prepared.unknown.map((adoId) => `PBI-${adoId} isn't in PowerLoom.`)];
}
