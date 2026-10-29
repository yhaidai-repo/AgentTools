// The vault setting `repoCommands` as stored: each repo's build and test commands, by its catalogue name.
export interface RepoBuildCommands {
  repos: Record<string, { build?: string; test?: string }>;
}
