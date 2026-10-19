import { cookies } from "next/headers";
import { currentVault } from "./currentVault";
import { SHARED_FILTERS, pageFilterCookie, sharedFilterCookie } from "./sharedFilters";

type Params = Record<string, string | undefined>;

// The filters a page renders with: the URL's, or (when it has none, e.g. via the menu) the page's remembered ones; a shared
// filter the URL doesn't set comes from the last page that set it in this vault. Read on the server, so the first paint
// is filtered.
export async function rememberedParams(pathname: string, params: Params): Promise<Params> {
  const store = await cookies();
  const vault = (await currentVault()) ?? "";
  const hasOwn = Object.values(params).some((value) => value !== undefined);
  const base = hasOwn ? params : Object.fromEntries(new URLSearchParams(store.get(pageFilterCookie(pathname))?.value ?? ""));
  const shared = SHARED_FILTERS.filter((name) => params[name] === undefined).map((name) => [name, store.get(sharedFilterCookie(name, vault))?.value]);

  return { ...base, ...Object.fromEntries(shared.filter(([, value]) => value)) };
}
