// What a restore looks at in the repo's unchanged copy before it decides what to run.
export interface RepoProbe {
  /** The folder restored, absolute in the restore container. */
  folder: string;
  /** A solution or project the agent named; null for the whole folder. */
  file: string | null;
  /** The file names directly in the folder. */
  files: string[];
  /** The repo root has .config/dotnet-tools.json. */
  hasDotnetTools: boolean;
  /** The repo's .powerloom/sandbox.json, as committed; null when it has none. */
  override: string | null;
  /** The folder's .npmrc, as committed; null when it has none. */
  npmrc: string | null;
}
