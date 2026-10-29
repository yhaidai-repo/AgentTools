import { createHash } from "node:crypto";
import { guideChecksum, guideZip } from "@powerloom/core";
import { currentVault } from "@/lib/currentVault";
import { loadGuideImage, loadGuidePackage } from "@/lib/guidePackages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const vault = await currentVault(), { id } = await context.params;
  const pkg = vault ? await loadGuidePackage(id, vault) : null;
  if (!pkg) return new Response("Guide not found", { status: 404 });
  const files: import("@powerloom/core").ArchiveFile[] = pkg.files.map(f => ({ path: f.path, content: Buffer.from(f.text) }));
  for (const image of pkg.images) {
    const asset = await loadGuideImage(pkg, image.name);
    if (!asset || createHash("sha256").update(asset.content).digest("hex") !== image.sha256) return new Response("Guide asset missing or changed", { status: 409 });
    files.push({ path: "images/" + image.name, content: asset.content });
  }
  const scope = files.filter(f => !["manifest.json", "publish-task.md"].includes(f.path));
  if (guideChecksum(scope) !== pkg.contentChecksum) return new Response("Guide content checksum failed", { status: 409 });
  const archive = guideZip(files);
  return new Response(new Uint8Array(archive), { headers: {
    "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="' + id + '.zip"',
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "X-Archive-SHA256": createHash("sha256").update(archive).digest("hex"),
  } });
}
