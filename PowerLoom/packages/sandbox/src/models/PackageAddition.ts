// A NuGet package a restore adds to a project (`dotnet add <project> package <id>`), so its files land in the package
// cache for offline builds; the project file the restore changed is thrown away with the restore's copy.
export interface PackageAddition {
  /** The project, relative to the repo's root, e.g. src/Api/Api.csproj. */
  project: string;
  id: string;
  /** Left out for the newest version the feeds have. */
  version?: string;
}
