// A sandbox's package cache as a restore sees it: NuGet package versions, and the whole cache's size.
export interface PackageCacheSize {
  nugetPackages: number;
  bytes: number;
  /** NuGet package versions this restore added so far. */
  addedPackages: number;
}
