// A vault's sandbox (Settings → Data access → Sandbox; PowerLoom's API saves it as SandboxSetting, key `sandbox`).
export interface SandboxSettings {
  /** The hosts the vault's package restores may reach: exact names or `*.domain`. */
  packageHosts: string[];
  /** A name from the sandbox image catalog; empty for the catalog's first image. */
  image: string;
}
