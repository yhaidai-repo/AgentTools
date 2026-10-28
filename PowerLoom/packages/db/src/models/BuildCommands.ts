// A repo's build and test commands as its vault's settings name them (repoCommands); null when none is set.
export interface BuildCommands {
  build: string | null;
  test: string | null;
}
