import { randomBytes } from "node:crypto";
import type { DepsEnv } from "./models/DepsEnv";

export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function docsExclude(): string[] {
  return (process.env.DOCS_EXCLUDE ?? "").split(",").map((folder) => folder.trim()).filter(Boolean);
}

// Skills: PowerLoom's own (in the image) first, then the user's mounted skills folder.
export function skillFolders(): string[] {
  return (process.env.SKILL_FOLDERS ?? "").split(":").filter(Boolean);
}

// Git auth for a vault's repo cache: its ADO token as a Basic header, passed per git command and never stored.
export function adoAuthHeader(pat: string): string | undefined {
  return pat ? `Authorization: Basic ${Buffer.from(`:${pat}`).toString("base64")}` : undefined;
}

const GITHUB_GIT = "http.https://github.com/.extraHeader";

// A vault's git sign-in (user decision 2026-10-25: GitHub repos next to Azure DevOps ones): the ADO token for every
// host, as before, and the GitHub token for github.com only. Git adds up the headers of every matching setting; the
// empty GitHub value first drops the ADO one there, so GitHub never sees the ADO token. Passed per command, never stored.
export function repoGitAuth(adoPat: string, githubToken: string): string[] {
  const ado = adoAuthHeader(adoPat);
  const github = githubToken ? [`${GITHUB_GIT}=`, `${GITHUB_GIT}=Authorization: Basic ${Buffer.from(`x-access-token:${githubToken}`).toString("base64")}`] : [];

  return [...(ado ? [`http.extraHeader=${ado}`] : []), ...github];
}

// The deps' environment as the compose services set it; the host names its own token route.
export function depsEnvFromProcess(azureTokenUrl: string): DepsEnv {
  return {
    vaultsRoot: requireEnv("VAULTS_DIR"),
    backlogMount: requireEnv("BACKLOG_MOUNT"),
    repoCacheRoot: requireEnv("REPO_CACHE_ROOT"),
    docsExclude: docsExclude(),
    skillFolders: skillFolders(),
    powerloomUrl: requireEnv("POWERLOOM_URL").replace(/\/+$/, ""),
    azureTokenUrl,
    azureTokenSecret: randomBytes(32).toString("hex"),
    confluenceSite: process.env.CONFLUENCE_SITE?.trim().replace(/\/+$/, "") || null,
    captureHome: process.env.VAULT_CAPTURE_HOME,
  };
}
