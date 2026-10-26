import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AzureMcpStart } from "@powerloom/azure";
import { SharedAzureServers } from "./SharedAzureServers";

class FakeServer {
  closed = false;

  async close(): Promise<void> {
    this.closed = true;
  }
}

const options = (tenant: string): AzureMcpStart => ({ namespaces: ["monitor"], env: { AZURE_TENANT_ID: tenant } });

function pool(): { servers: SharedAzureServers<FakeServer>; started: FakeServer[]; startCount: () => number } {
  const started: FakeServer[] = [];
  const servers = new SharedAzureServers(async () => {
    const server = new FakeServer();

    started.push(server);

    return server;
  });

  return { servers, started, startCount: () => started.length };
}

describe("SharedAzureServers", () => {
  it("starts one server per vault and hands the same one to every session", async () => {
    const { servers, startCount } = pool();
    const first = await servers.of("work-projects", options("t1"));
    const second = await servers.of("work-projects", options("t1"));

    assert.equal(first, second);
    assert.equal(startCount(), 1);
  });

  it("lets a caller that arrives while the server is still starting wait for the same start", async () => {
    const starts: Array<() => void> = [];
    const servers = new SharedAzureServers(() => new Promise<FakeServer>((resolve) => starts.push(() => resolve(new FakeServer()))));
    const early = servers.of("work-projects", options("t1"));
    const late = servers.of("work-projects", options("t1"));

    assert.equal(starts.length, 1);
    starts[0]();
    assert.equal(await early, await late);
  });

  it("keeps a server per vault", async () => {
    const { servers, startCount } = pool();

    await servers.of("work-projects", options("t1"));
    await servers.of("personal-projects", options("t1"));

    assert.equal(startCount(), 2);
  });

  it("starts a new server and closes the old one when the sign-in changed", async () => {
    const { servers, started } = pool();

    await servers.of("work-projects", options("t1"));
    await servers.of("work-projects", options("t2"));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(started.length, 2);
    assert.equal(started[0].closed, true);
    assert.equal(started[1].closed, false);
  });

  it("forgets a start that failed, so the next caller tries again", async () => {
    let attempts = 0;
    const servers = new SharedAzureServers(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("npx failed");
      }

      return new FakeServer();
    });

    await assert.rejects(servers.of("work-projects", options("t1")), /npx failed/);
    await servers.of("work-projects", options("t1"));

    assert.equal(attempts, 2);
  });

  it("closes every server when the host stops", async () => {
    const { servers, started } = pool();

    await servers.of("work-projects", options("t1"));
    await servers.of("personal-projects", options("t1"));
    await servers.closeAll();

    assert.deepEqual(started.map((server) => server.closed), [true, true]);
  });
});
