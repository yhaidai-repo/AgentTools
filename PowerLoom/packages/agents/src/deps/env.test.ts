import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repoGitAuth } from "./env";

const basic = (text: string) => `Authorization: Basic ${Buffer.from(text).toString("base64")}`;

describe("repoGitAuth", () => {
  it("signs every host in with the ADO token and github.com with the GitHub token alone", () => {
    assert.deepEqual(repoGitAuth("ado-pat", "gh-token"), [
      `http.extraHeader=${basic(":ado-pat")}`,
      "http.https://github.com/.extraHeader=",
      `http.https://github.com/.extraHeader=${basic("x-access-token:gh-token")}`,
    ]);
  });

  it("leaves out what the vault has no token for", () => {
    assert.deepEqual(repoGitAuth("", ""), []);
    assert.deepEqual(repoGitAuth("ado-pat", ""), [`http.extraHeader=${basic(":ado-pat")}`]);
  });
});
