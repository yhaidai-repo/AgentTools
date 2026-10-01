import { attachment } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";

// Downloads the original upload.
export async function GET(_request: Request, { params }: { params: Promise<{ adoId: string; attachmentId: string }> }) {
  const { adoId, attachmentId } = await params;
  const [row] = await getDb()
    .select()
    .from(attachment)
    .where(and(eq(attachment.id, Number(attachmentId)), eq(attachment.pbiId, Number(adoId))));

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    },
  });
}
