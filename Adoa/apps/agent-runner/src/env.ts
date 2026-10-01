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

// Skills: adoa's own (in the image) first, then the user's mounted skills folder.
export function skillFolders(): string[] {
  return (process.env.SKILL_FOLDERS ?? "").split(":").filter(Boolean);
}

// Git auth for the repo cache: the ADO token as a Basic header, passed per git command and never stored.
export function adoAuthHeader(): string | undefined {
  const pat = process.env.ADO_PAT;

  return pat ? `Authorization: Basic ${Buffer.from(`:${pat}`).toString("base64")}` : undefined;
}
