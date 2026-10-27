import assert from "node:assert/strict";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { PowerLoomDb, repo } from "@powerloom/db";
import { agentRepos } from "./agentRepos";
import { reviewRepo } from "../codeReview/ReviewWriter";
import { createOpenRepoTool } from "./openRepoTool";
import type { RepoAccess } from "../models/RepoAccess";

type Repo = typeof repo.$inferSelect;
const row = (id: string, name: string, excluded = false) => ({ id, name, excluded, vault: "demo", remoteUrl: `https://example.invalid/${id}`, defaultBranch: "refs/heads/main" }) as Repo;
function database(rows: Repo[]): PowerLoomDb {
  const dialect = new PgDialect();
  return { select: () => ({ from: () => ({ where: (predicate: Parameters<PgDialect["sqlToQuery"]>[0]) => ({ orderBy: async () => {
    const query = dialect.sqlToQuery(predicate);
    assert.deepEqual(query.params, ["demo", false]);
    return rows.filter(value => value.vault === query.params[0] && value.excluded === query.params[1]);
  } }) }) }) } as unknown as PowerLoomDb;
}

for (const names of [["Foo Bar", "Foo-Bar"], ["a/b", "a-b"], ["Foo-Bar", "foo-bar"]]) {
  it(`rejects colliding catalog identities ${names.join(" / ")} in either source order`, async () => {
    const db = database([row("wanted", names[0]), row("other", names[1])]);
    for (const order of [names, [...names].reverse()]) {
      await assert.rejects(async () => {
        const refs = await agentRepos(db, order.map(name => ({ vault: "demo", names: [name] })));
        reviewRepo({ isOn: true, repos: refs, commits: {}, tools: [] }, names[0]);
      }, /collide/);
    }
  });
}

it("preserves catalog identity when a disabled target shares an enabled repo's folder spelling", async () => {
  const db = database([row("wanted", "Foo Bar", true), row("other", "Foo-Bar")]);
  for (const names of [["Foo Bar", "Foo-Bar"], ["Foo-Bar", "Foo Bar"]]) {
    const refs = await agentRepos(db, names.map(name => ({ vault: "demo", names: [name] })));
    const access = { isOn: true, repos: refs, commits: {}, tools: [] };
    assert.equal(refs.length, 1);
    assert.throws(() => reviewRepo(access, "Foo Bar"), /disabled/);
    assert.equal(reviewRepo(access, "Foo-Bar").remoteUrl, "https://example.invalid/other");
  }
});

it("deduplicates the same catalog row and selects a non-first requested repo case-insensitively", async () => {
  const db = database([row("other", "Other"), row("wanted", "Target App")]);
  const refs = await agentRepos(db, [{ vault: "demo", names: ["Other", "target app"] }, { vault: "demo", names: ["TARGET APP"] }]);
  assert.equal(refs.length, 2);
  assert.equal(reviewRepo({ isOn: true, repos: refs, commits: {}, tools: [] }, "TARGET APP").remoteUrl, "https://example.invalid/wanted");
});

it("rejects a dynamically opened collision before acquiring a different remote", async () => {
  const db = database([row("wanted", "Foo Bar"), row("other", "Foo-Bar")]);
  const repos = await agentRepos(db, [{ vault: "demo", names: ["Foo Bar"] }]);
  const access: RepoAccess = { isOn: true, repos, commits: {}, tools: [] };
  let acquired = 0;
  const context = { deps: { db, repoCache: { acquire: async () => { acquired++; return {}; } } }, agent: { options: {} } } as any;
  const tool = await createOpenRepoTool(context, { phase: async () => undefined } as any, access, repos.map(ref => ref.name), "demo");
  await assert.rejects(tool.handler({ name: "Foo-Bar" }), /collide/);
  assert.equal(acquired, 0);
  assert.equal(access.repos.length, 1);
});
