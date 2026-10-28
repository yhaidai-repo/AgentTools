import type { components } from "@powerloom/client";
import { readImageCatalog } from "@powerloom/sandbox";
import { powerloom } from "@/lib/powerloom";
import type { SandboxImageOption } from "@/models/SandboxImageOption";

export type SandboxSetting = components["schemas"]["SandboxSetting"];

// Settings → Data access → Sandbox of a vault; null while PowerLoom isn't reachable.
export async function loadSandbox(vault: string): Promise<SandboxSetting | null> {
  const { data } = await powerloom.GET("/api/vaults/{vault}/sandbox", { params: { path: { vault } } });

  return data ?? null;
}

// The images a vault may pick, from the catalog the sandbox service reads too (SANDBOX_IMAGES); the first is the default.
export function loadImageOptions(): SandboxImageOption[] {
  return readImageCatalog(process.env.SANDBOX_IMAGES?.trim() || undefined).map(({ name, description }) => ({ name, description }));
}
