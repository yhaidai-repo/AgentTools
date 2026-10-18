import { pageUrl } from "./pageUrl";

// The Vault page's address: its tab and that tab's choices (period, agent, page, size, register, ...).
export function vaultUrl(params: Record<string, string | number | undefined>): string {
  return pageUrl("/vault", params);
}
