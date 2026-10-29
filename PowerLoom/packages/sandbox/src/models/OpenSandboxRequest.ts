export interface OpenSandboxRequest {
  /** Who it belongs to: `powerloom-run-<id>`; the run's end removes it by this name. */
  owner: string;
  /** The service removes it after this long, whatever happens to the run. */
  ttlMinutes: number;
  /** A name from the image catalog (the vault's Settings → Sandbox); the catalog's first image when left out. */
  image?: string;
  /** The package cache it shares with every sandbox of the same key (the run's vault): what one run restores, the next
   *  builds from offline. Left out, the sandbox gets a cache of its own, removed with it. */
  packageCache?: string;
}
