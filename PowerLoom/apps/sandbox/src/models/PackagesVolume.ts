// Where a sandbox's restored packages live: the vault's cache, shared by its sandboxes and kept after them, or a volume
// of the sandbox's own, removed with it.
export interface PackagesVolume {
  name: string;
  shared: boolean;
}
