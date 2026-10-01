export interface RepoRef {
  /** Folder name inside the cache; also the name agents use in paths. */
  name: string;
  remoteUrl: string;
  defaultBranch: string;
}
