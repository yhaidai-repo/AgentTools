import { guideAsset, localItem } from "@powerloom/db";
import { and, eq } from "drizzle-orm";
import type { GuidePackageData } from "@powerloom/core";
import { getDb } from "./db";

export async function loadGuidePackage(id: string, vault: string): Promise<GuidePackageData | null> {
  const [item] = await getDb().select({ data: localItem.data }).from(localItem).where(and(eq(localItem.id, id), eq(localItem.vault, vault), eq(localItem.kind, "demonstration-result"))).limit(1);
  return (item?.data as { guidePackage?: GuidePackageData } | undefined)?.guidePackage ?? null;
}
export async function loadGuideImage(pkg: GuidePackageData, name: string) {
  const image = pkg.images.find(i => i.name === name);
  if (!image) return null;
  const [asset] = await getDb().select().from(guideAsset).where(and(eq(guideAsset.id, image.id), eq(guideAsset.taskId, pkg.taskId), eq(guideAsset.vault, pkg.vault)));
  return asset ?? null;
}
