export interface RepositoryDto {
  id: string;
  name: string;
  remoteUrl: string;
  defaultBranch?: string;
  isDisabled?: boolean;
  project: { name: string };
}
