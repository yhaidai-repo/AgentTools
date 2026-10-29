import assert from "node:assert/strict";
import { test } from "node:test";
import type { RepoProbe } from "../models/RepoProbe";
import { npmrcAuth, nugetCredentialEnv, nugetSourcesOf } from "./feedCredentials";
import { additionSteps } from "./packageAdditions";
import { restorePlanOf } from "./restorePlan";

const credentials = [{ urlPrefixes: ["https://pkgs.dev.azure.com/acme/"], username: "powerloom", password: "pat" }];

function probe(files: string[], extra: Partial<RepoProbe> = {}): RepoProbe {
  return { folder: "/work/app", file: null, files, hasDotnetTools: false, override: null, npmrc: null, ...extra };
}

test("restores the folder's solutions, else its projects, and keeps a lock file's versions", () => {
  const solutions = restorePlanOf(probe(["App.sln", "Tools.slnx", "App.csproj", "packages.lock.json"]));
  const projects = restorePlanOf(probe(["App.csproj"], { hasDotnetTools: true }));

  assert.deepEqual(solutions.steps.map((step) => step.argv.join(" ")), ["dotnet restore App.sln --locked-mode", "dotnet restore Tools.slnx --locked-mode"]);
  assert.deepEqual(projects.steps.map((step) => step.label), ["dotnet restore App.csproj", "dotnet tool restore"]);
});

test("npm only from a lock file and without install scripts; deno from deno.json", () => {
  const locked = restorePlanOf(probe(["package.json", "package-lock.json", "deno.json"]));
  const unlocked = restorePlanOf(probe(["package.json"]));

  assert.deepEqual(locked.steps.map((step) => step.label), ["npm ci --ignore-scripts", "deno install"]);
  assert.deepEqual(unlocked.steps, []);
  assert.match(unlocked.skipped[0], /no package-lock\.json/);
});

test("a named project restores only that project", () => {
  const plan = restorePlanOf(probe(["App.sln", "package.json", "package-lock.json"], { file: "src/Api/Api.csproj" }));

  assert.deepEqual(plan.steps.map((step) => step.label), ["dotnet restore src/Api/Api.csproj"]);
});

test("the repo's own restore commands replace the detected ones; a broken file is reported", () => {
  const own = restorePlanOf(probe(["App.sln"], { override: JSON.stringify({ restore: ["make deps"] }) }));
  const broken = restorePlanOf(probe(["App.sln"], { override: "{ not json" }));

  assert.deepEqual(own.steps.map((step) => step.argv), [["bash", "-lc", "make deps"]]);
  assert.deepEqual(broken.steps.map((step) => step.label), ["dotnet restore App.sln"]);
  assert.match(broken.skipped[0], /ignored/);
});

test("NuGet credentials go only to sources the credential covers", () => {
  const listing = "Registered Sources:\n  1.  nuget.org [Enabled]\n      https://api.nuget.org/v3/index.json\n  2.  Team Feed [Enabled]\n      https://pkgs.dev.azure.com/acme/_packaging/team/nuget/v3/index.json\n";
  const sources = nugetSourcesOf(listing);

  assert.deepEqual(sources.map((source) => source.name), ["nuget.org", "Team Feed"]);
  assert.deepEqual(nugetCredentialEnv(sources, credentials), ["NuGetPackageSourceCredentials_Team Feed=Username=powerloom;Password=pat;ValidAuthenticationTypes=basic"]);
});

test("npm sign-in lines only for covered registries", () => {
  const npmrc = "registry=https://registry.npmjs.org/\n@acme:registry=https://pkgs.dev.azure.com/acme/_packaging/team/npm/registry/\n";
  const auth = npmrcAuth(npmrc, credentials);

  assert.equal(auth, "//pkgs.dev.azure.com/acme/_packaging/team/npm/registry/:username=powerloom\n//pkgs.dev.azure.com/acme/_packaging/team/npm/registry/:_password=cGF0\n//pkgs.dev.azure.com/acme/_packaging/team/npm/registry/:email=npm@powerloom.local\n");
  assert.equal(npmrcAuth(null, credentials), null);
});

test("added packages become dotnet add steps at the repo's root, checked before anything runs", () => {
  const steps = additionSteps("/work/app", [{ project: "src/Api/Api.csproj", id: "Polly", version: "8.4.2" }, { project: "./Tests.fsproj", id: "xunit.v3" }]);

  assert.ok(steps.ok);
  assert.deepEqual(steps.value.map((step) => step.argv), [["dotnet", "add", "src/Api/Api.csproj", "package", "Polly", "--version", "8.4.2"], ["dotnet", "add", "Tests.fsproj", "package", "xunit.v3"]]);
  assert.deepEqual(steps.value.map((step) => step.cwd), ["/work/app", "/work/app"]);
});

test("an addition outside the repo, of a non-project or with a strange id or version is refused", () => {
  const refused = [
    { project: "../other/Other.csproj", id: "Polly" },
    { project: "src/App.sln", id: "Polly" },
    { project: "-x.csproj", id: "Polly" },
    { project: "App.csproj", id: "--source=http://evil" },
    { project: "App.csproj", id: "Polly", version: "1.0; rm -rf /" },
  ];

  for (const addition of refused) {
    assert.equal(additionSteps("/work/app", [addition]).ok, false, JSON.stringify(addition));
  }
});
