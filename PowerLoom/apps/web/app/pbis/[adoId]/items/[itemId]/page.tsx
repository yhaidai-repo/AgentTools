import { notFound } from "next/navigation";
import { loadItemDetail } from "@/lib/pbiDetail";
import { ItemView } from "@/app/items/ItemView";

export const dynamic = "force-dynamic";

export default async function PbiItemPage({ params, searchParams }: { params: Promise<{ adoId: string; itemId: string }>; searchParams: Promise<{ v?: string }> }) {
  const { adoId, itemId } = await params;
  const detail = await loadItemDetail(decodeURIComponent(itemId));

  if (!detail || detail.item.pbiId !== Number(adoId)) {
    notFound();
  }

  return <ItemView detail={detail} chosen={(await searchParams).v} />;
}
