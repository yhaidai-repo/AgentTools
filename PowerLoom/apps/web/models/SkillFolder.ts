export interface SkillFolder {
  /** Path inside the containers. */
  path: string;
  /** Where the user finds it on the host. */
  hostPath: string;
  /** Only PowerLoom's own skills can be edited from PowerLoom (user decision 2026-10-01); other folders are view-only. */
  editable: boolean;
}
