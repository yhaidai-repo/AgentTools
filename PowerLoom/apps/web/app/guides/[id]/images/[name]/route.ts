import { createHash } from "node:crypto";
import { currentVault } from "@/lib/currentVault";
import { loadGuideImage, loadGuidePackage } from "@/lib/guidePackages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string; name: string }> }) {
  const vault = await currentVault(), { id, name } = await context.params;
  if (!/^[a-z0-9][a-z0-9-]*\.png$/.test(name)) return new Response("Not found", { status: 404 });
  const pkg = vault ? await loadGuidePackage(id, vault) : null, image = pkg?.images.find(i => i.name === name);
  const asset = pkg && image ? await loadGuideImage(pkg, name) : null;
  if (!asset || createHash("sha256").update(asset.content).digest("hex") !== image!.sha256) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.content), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
