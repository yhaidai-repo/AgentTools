export interface RestoreStep {
  /** What the agent reads, e.g. `dotnet restore App.sln`. */
  label: string;
  /** Which feeds' sign-ins it needs: NuGet's come as variables, npm's from the home's .npmrc. */
  ecosystem: "dotnet" | "npm" | "deno" | "repo";
  argv: string[];
  cwd: string;
}
