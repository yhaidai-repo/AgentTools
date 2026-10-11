import { revalidatePath } from "next/cache";

// The change went through PowerLoom, which recalculated the PBI and rendered its notes; the pages only need to show it.
export async function afterItemChange(adoId: number | null): Promise<void> {
  revalidatePath(adoId === null ? "/tasks" : `/pbis/${adoId}`, "layout");
}
