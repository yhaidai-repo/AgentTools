import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Dispatcher } from "undici";
import { SandboxClient } from "./SandboxClient";
import { waitingDispatcher } from "./waitingDispatcher";

const SERVICE_URL = "http://sandbox:3300";

interface Recorded {
  timeouts: number[];
  dispatchers: unknown[];
  destroyed: number;
}

function recordingClient(fetcher: typeof fetch): { client: SandboxClient; recorded: Recorded } {
  const recorded: Recorded = { timeouts: [], dispatchers: [], destroyed: 0 };
  const dispatcherFor = (timeoutMs: number): Dispatcher => {
    const dispatcher = { destroy: async () => { recorded.destroyed++; } } as unknown as Dispatcher;

    recorded.timeouts.push(timeoutMs);
    recorded.dispatchers.push(dispatcher);

    return dispatcher;
  };

  return { client: new SandboxClient(SERVICE_URL, "token", fetcher, dispatcherFor), recorded };
}

function answering(body: unknown, seen: unknown[]): typeof fetch {
  return (async (_input: unknown, init?: RequestInit) => {
    seen.push((init as { dispatcher?: unknown }).dispatcher);

    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

function emptyTar(): ReadableStream<Uint8Array> {
  return new ReadableStream({ start: (controller) => controller.close() });
}

function slowServer(delayMs: number): Promise<Server> {
  const server = createServer((_request, response) => {
    setTimeout(() => response.end("{}"), delayMs);
  });

  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("a restore's dispatcher waits the restore's 30 minutes and is let go after the answer", async () => {
  const seen: unknown[] = [];
  const { client, recorded } = recordingClient(answering({ steps: [] }, seen));

  const answer = await client.restore("box", "repo", "", emptyTar(), [], []);

  assert.equal(answer.ok, true);
  assert.deepEqual(recorded.timeouts, [30 * 60_000]);
  assert.deepEqual(seen, recorded.dispatchers);
  assert.equal(recorded.destroyed, 1);
});

test("a restore's progress is a short GET of the repo's restore, and none running reads as null", async () => {
  const urls: string[] = [];
  const fetcher = (async (input: unknown, init?: RequestInit) => {
    urls.push(`${init?.method} ${String(input)}`);

    return new Response("null", { status: 200 });
  }) as typeof fetch;
  const { client, recorded } = recordingClient(fetcher);

  const answer = await client.restoreProgress("box", "my repo");

  assert.deepEqual(answer, { ok: true, value: null });
  assert.deepEqual(urls, [`GET ${SERVICE_URL}/sandboxes/box/restore/my%20repo`]);
  assert.deepEqual(recorded.timeouts, [60_000]);
});

test("a command's dispatcher waits the command's timeout plus the margin", async () => {
  const { client, recorded } = recordingClient(answering({ exitCode: 0 }, []));

  await client.run("box", { command: "dotnet build", timeoutMs: 600_000 });

  assert.deepEqual(recorded.timeouts, [630_000]);
});

test("a fetch rejection is the service not answering, and the dispatcher is still let go", async () => {
  const failing = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const { client, recorded } = recordingClient(failing);

  const answer = await client.health();

  assert.deepEqual(answer, { ok: false, message: "The sandbox service at http://sandbox:3300 doesn't answer (fetch failed).", failure: "failed" });
  assert.equal(recorded.destroyed, 1);
});

test("Node's fetch honours the waiting dispatcher's headers timeout", async () => {
  const server = await slowServer(1_000);
  const { port } = server.address() as AddressInfo;
  const dispatcher = waitingDispatcher(200);

  try {
    const call = fetch(`http://127.0.0.1:${port}/`, { dispatcher } as RequestInit);

    await assert.rejects(call, (error: Error) => (error.cause as { code?: string }).code === "UND_ERR_HEADERS_TIMEOUT");
  } finally {
    await dispatcher.destroy();
    server.closeAllConnections();
    server.close();
  }
});
