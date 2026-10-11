export interface AdoRepository {
  id: string;
  name: string;
  project: string;
  remoteUrl: string;
  defaultBranch: string | null;
  isDisabled: boolean;
}
