import { notFound, redirect } from "next/navigation";
import { itemPath } from "@/lib/items";
import { loadItemDetail } from "@/lib/pbiDetail";
import { ItemView } from "@/app/items/ItemView";

export const dynamic = "force-dynamic";

// Items without a PBI live here; an item of a PBI opens under its PBI.
export default async function TaskItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const detail = await loadItemDetail(decodeURIComponent((await params).itemId));

  if (!detail) {
    notFound();
  }

  if (detail.item.pbiId !== null) {
    redirect(itemPath(detail.item));
  }

  return <ItemView detail={detail} />;
}
