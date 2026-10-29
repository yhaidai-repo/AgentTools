// The hosts a restore may reach, matched case-insensitively against the whole host name:
// - an exact name (`api.nuget.org`);
// - `*.suffix` for every host under a domain, however deep (download hosts often are many, e.g. a feed's blob storage);
// - `*` inside a label for any run of characters except `.` (`*vsblobprod*.blob.core.windows.net`: Azure Artifacts'
//   randomly named storage accounts, without opening all of blob.core.windows.net).
const ANY_SUBDOMAINS = "*.";

export class HostAllowlist {
  private readonly patterns: RegExp[];

  constructor(entries: string[]) {
    const names = new Set(entries.map((entry) => entry.trim().toLowerCase()).filter(Boolean));

    this.patterns = [...names].map(compile);
  }

  static fromList(list: string): HostAllowlist {
    return new HostAllowlist(list.split(","));
  }

  allows(host: string): boolean {
    const name = host.toLowerCase();

    return this.patterns.some((pattern) => pattern.test(name));
  }

  get size(): number {
    return this.patterns.length;
  }
}

function compile(entry: string): RegExp {
  const subdomains = entry.startsWith(ANY_SUBDOMAINS) ? ".+\\." : "";
  const rest = subdomains ? entry.slice(ANY_SUBDOMAINS.length) : entry;

  return new RegExp(`^${subdomains}${rest.split("*").map(escape).join("[^.]*")}$`);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
