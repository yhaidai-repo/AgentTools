import type { PowerLoomDb } from "@powerloom/db";
import { z } from "zod";
import type { SandboxSettings } from "./models/SandboxSettings";
import { SANDBOX_KEY, saveValue, vaultSettingKey } from "./settings";

// What the egress proxy's HostAllowlist (apps/sandbox) matches: a host name, `*.suffix` for every host under it, or `*`
// inside a label. Anything else (a scheme, a path, a port, whitespace) would never match a request's host.
const HOST_LABEL = /^(\*|[a-z0-9*]([a-z0-9*-]*[a-z0-9*])?)$/;
// A restore reaches a handful of hosts; the bound (the API's too) only keeps a pasted list from growing without end.
const MAX_HOSTS = 50;
const IMAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const HOST_HINT = "give names like api.nuget.org, or *.example.com for every host under it";

/** Why an entry is not a package host the proxy would match, or null when it is one. */
export function packageHostProblem(entry: string): string | null {
  if (/\s/.test(entry)) {
    return `Not a host name: "${entry}" has whitespace; ${HOST_HINT}.`;
  }

  if (entry.includes("/")) {
    return `Not a host name: ${entry} has a scheme or a path; ${HOST_HINT}.`;
  }

  if (entry.includes(":")) {
    return `Not a host name: ${entry} has a port; ${HOST_HINT}.`;
  }

  return labelsProblem(entry);
}

function labelsProblem(entry: string): string | null {
  const labels = entry.split(".");

  if (labels.length < 2 || labels.some((label) => !HOST_LABEL.test(label))) {
    return `Not a host name: ${entry}; ${HOST_HINT}.`;
  }

  if (labels.every((label) => label === "*")) {
    return `${entry} would allow every host; ${HOST_HINT}.`;
  }

  return null;
}

/** The hosts as the proxy compares them: trimmed, lower-case, without empties and repeats, in the order given. */
export function normalizePackageHosts(entries: string[]): string[] {
  const names = entries.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);

  return [...new Set(names)];
}

/** Why the list cannot be saved, or null: the first bad entry, or too many. */
export function packageHostsProblem(hosts: string[]): string | null {
  const problem = hosts.map(packageHostProblem).find((found) => found !== null);

  if (problem) {
    return problem;
  }

  return hosts.length > MAX_HOSTS ? `At most ${MAX_HOSTS} package hosts.` : null;
}

/** The full host list as a command's input, normalized before it is checked. */
export const packageHostsInput = z.array(z.string()).transform(normalizePackageHosts).superRefine((hosts, context) => {
  const problem = packageHostsProblem(hosts);

  if (problem) {
    context.addIssue({ code: "custom", message: problem });
  }
});

/** An image name of the catalog as a command's input; empty for the catalog's first image. */
export const sandboxImageInput = z.string().trim().max(100).refine((name) => name.length === 0 || IMAGE_NAME.test(name), "an image name of the catalog (lower-case letters, digits, . _ -), or empty for the default");

export async function saveSandboxSettings(db: PowerLoomDb, vault: string, settings: SandboxSettings): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, SANDBOX_KEY), settings);
}
