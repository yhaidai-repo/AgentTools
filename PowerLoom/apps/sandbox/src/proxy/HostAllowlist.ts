// The hosts a restore may reach: exact names, or `*.suffix` for every host under a domain (download hosts often are
// many, e.g. a feed's blob storage).
export class HostAllowlist {
  private readonly exact = new Set<string>();
  private readonly suffixes: string[] = [];

  constructor(entries: string[]) {
    entries.map((entry) => entry.trim().toLowerCase()).filter(Boolean).forEach((entry) => this.add(entry));
  }

  static fromList(list: string): HostAllowlist {
    return new HostAllowlist(list.split(","));
  }

  allows(host: string): boolean {
    const name = host.toLowerCase();

    return this.exact.has(name) || this.suffixes.some((suffix) => name.endsWith(suffix));
  }

  get size(): number {
    return this.exact.size + this.suffixes.length;
  }

  private add(entry: string): void {
    if (entry.startsWith("*.")) {
      this.suffixes.push(entry.slice(1));
    } else {
      this.exact.add(entry);
    }
  }
}
