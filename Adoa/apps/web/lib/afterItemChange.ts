import { DISPATCH_QUEUE, type DispatchJob } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "./boss";

// The web writes the DB only; a dispatcher tick now (instead of within the minute) updates the statuses and the Vault.
export async function afterItemChange(adoId: number | null): Promise<void> {
  const job: DispatchJob = {};

  await (await getBoss()).send(DISPATCH_QUEUE, job);
  revalidatePath(adoId === null ? "/tasks" : `/pbis/${adoId}`, "layout");
}
