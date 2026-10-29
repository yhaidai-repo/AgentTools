import type { PackageFeedView } from "./PackageFeedView";

// Settings → Data access → Sandbox as a chat may read it: the image, the package hosts and the private feeds without their tokens.
export interface SandboxSettingsView {
  /** A name from the sandbox image catalog; empty for the catalog's first image. */
  image: string;
  /** The hosts the vault's package restores may reach (the vault's own Azure DevOps feeds and the private feeds' hosts are added per restore). */
  packageHosts: string[];
  feeds: PackageFeedView[];
}
