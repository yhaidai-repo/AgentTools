import { localItem } from "@adoa/db";
import { eq, isNull, type SQL } from "drizzle-orm";

// Items belong to a PBI or, like a chat draft's tech-writer task and its findings, to none.
export function itemOfPbi(adoId: number | null): SQL {
  return adoId === null ? isNull(localItem.pbiId) : eq(localItem.pbiId, adoId);
}

export function pbiLabel(adoId: number | null): string {
  return adoId === null ? "no PBI" : `PBI-${adoId}`;
}
