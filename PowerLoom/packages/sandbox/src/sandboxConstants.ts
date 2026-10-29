// The folder every sandbox works in; the only writable place besides /tmp and the home folder.
export const WORKSPACE = "/workspace";

// Where a sandbox sees the packages its restores fetched: read-only for the agent, written only by a restore container.
export const PACKAGES = "/packages";

// A restore call carries the feeds' sign-ins here (base64 JSON of FeedCredential[]), never in the URL.
export const FEED_CREDENTIALS_HEADER = "x-feed-credentials";

// … and the hosts its vault's restores may reach (base64 JSON of string[]).
export const PACKAGE_HOSTS_HEADER = "x-package-hosts";

// Docker labels on a sandbox container: the service finds its own containers, their owner and expiry by them.
export const SANDBOX_LABEL = "powerloom.sandbox";
export const SANDBOX_OWNER_LABEL = "powerloom.owner";
export const SANDBOX_EXPIRES_LABEL = "powerloom.expires";

// … and the NuGet packages it adds to projects first (base64 JSON of PackageAddition[]).
export const PACKAGE_ADDITIONS_HEADER = "x-package-additions";
