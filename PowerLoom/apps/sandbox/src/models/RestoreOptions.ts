import type { FeedCredential, PackageAddition } from "@powerloom/sandbox";

// What a restore call brings besides the repo: the feeds' sign-ins, the vault's package hosts (the only ones its pass
// opens at the proxy), and the NuGet packages it adds to projects first.
export interface RestoreOptions {
  credentials: FeedCredential[];
  hosts: string[];
  additions: PackageAddition[];
}
