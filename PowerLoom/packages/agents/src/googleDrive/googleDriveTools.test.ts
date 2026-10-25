import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { AgentDeps } from "../models/AgentDeps";
import type { DataAccessEntry } from "../models/DataAccessEntry";
import { DriveRequestError } from "./DriveRequestError";
import { createGoogleDriveTools, fileIdOf } from "./googleDriveTools";
import type { DriveFile } from "./models/DriveFile";
import type { GoogleDriveReader } from "./models/GoogleDriveReader";

const context = { vault: "work-projects", agentId: "research", runId: 42, owner: "powerloom-run-42", taskId: "AT-1-001", pbiId: 1 };
const agent = { capabilities: { integrations: { readGoogleDrive: true } } } as unknown as AgentDefinition;
const DOC = "application/vnd.google-apps.document";
const FOLDER = "application/vnd.google-apps.folder";

function file(id: string, name: string, parents: string[], mimeType = DOC): DriveFile {
  return { id, name, mimeType, parents, modifiedTime: "2026-10-20T10:00:00Z", size: null, webViewLink: null };
}

// specs (shared) > specs/old; outside > secret
const FILES: DriveFile[] = [
  file("specs", "Specs", [], FOLDER),
  file("old", "Old", ["specs"], FOLDER),
  file("plan", "Plan", ["old"]),
  file("outside", "Outside", [], FOLDER),
  file("secret", "Secret", ["outside"]),
];

function fakeDeps(options: { deniedToken?: boolean } = {}): { deps: AgentDeps; searched: string[][]; entries: DataAccessEntry[] } {
  const searched: string[][] = [];
  const entries: DataAccessEntry[] = [];
  const byId = (id: string) => FILES.find((entry) => entry.id === id)!;
  const reader: GoogleDriveReader = {
    childFolders: async (parents) => FILES.filter((entry) => entry.mimeType === FOLDER && entry.parents.some((parent) => parents.includes(parent))),
    search: async (parents) => (searched.push(parents), FILES.filter((entry) => entry.parents.some((parent) => parents.includes(parent)) && entry.mimeType !== FOLDER)),
    get: async (id) => {
      if (options.deniedToken) {
        throw new DriveRequestError(401, "Google refused the sign-in (400): invalid_grant");
      }

      return byId(id);
    },
    export: async (id) => `text of ${id}`,
    download: async () => Buffer.from(""),
  };
  const log = { record: async (entry: DataAccessEntry) => { entries.push(entry); } };
  const requests = { request: async () => ({ id: "HT-1-001", created: true }) };
  const deps = { outside: { log, requests }, googleDrive: { reader, folders: [{ id: "specs", name: "Specs" }] } } as unknown as AgentDeps;

  return { deps, searched, entries };
}

function tool(deps: AgentDeps, name: string) {
  return createGoogleDriveTools(deps, agent, context).find((candidate) => candidate.name === name)!;
}

describe("the Google Drive tools", () => {
  it("search the shared folders and the folders below them, and nothing for an agent without the switch", async () => {
    const { deps, searched, entries } = fakeDeps();
    const off = { capabilities: { integrations: {} } } as unknown as AgentDefinition;

    const result = await tool(deps, "drive_search").handler({ text: "plan" });

    assert.deepEqual(searched, [["specs", "old"]]);
    assert.match(result.text, /Plan · id plan/);
    assert.equal(entries[0].kind, "googleDrive");
    assert.deepEqual(createGoogleDriveTools(deps, off, context), []);
  });

  it("reads a file below a shared folder and refuses one outside them", async () => {
    const { deps, entries } = fakeDeps();

    const inside = await tool(deps, "drive_read").handler({ file: "https://docs.google.com/document/d/plan/edit" });
    const outside = await tool(deps, "drive_read").handler({ file: "secret" });

    assert.match(inside.text, /^Plan \(in Specs, modified 2026-10-20\)\n\ntext of plan$/);
    assert.equal(outside.isError, true);
    assert.equal(entries[1].outcome, "refused");
  });

  it("asks the user to sign in again when Google refuses the sign-in", async () => {
    const { deps, entries } = fakeDeps({ deniedToken: true });

    const result = await tool(deps, "drive_read").handler({ file: "plan" });

    assert.equal(entries[0].outcome, "denied");
    assert.match(result.text, /Task HT-1-001 asks a person to fix it/);
  });

  it("finds a file's id in its link", () => {
    assert.equal(fileIdOf("https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing"), "1AbC_d-E");
    assert.equal(fileIdOf("https://drive.google.com/open?id=1XyZ"), "1XyZ");
    assert.equal(fileIdOf(" 1AbC "), "1AbC");
  });
});
