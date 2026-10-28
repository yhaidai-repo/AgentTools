import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import { WebPageTexts } from "../webDocuments/WebPageTexts";
import { createFetchDocumentTools } from "../webDocuments/fetchDocumentTool";
import { createReadWebPageTools } from "./readWebPageTool";

const PAGE = "https://www.cms.gov/files/document/hets-270-271-companion-guide.pdf";

function agentWith(powerloomWeb: boolean): AgentDefinition {
  return { capabilities: { webAccess: !powerloomWeb, integrations: { powerloomWeb } } } as unknown as AgentDefinition;
}

function countingPages(text: string): { pages: WebPageTexts; downloads: () => number } {
  let downloads = 0;
  const pages = new WebPageTexts(async () => {
    downloads++;

    return { ok: true, value: text };
  });

  return { pages, downloads: () => downloads };
}

describe("read_web_page", () => {
  it("is given only to an agent with PowerLoom web on, whatever its native web access", () => {
    const pages = new WebPageTexts();

    assert.equal(createReadWebPageTools(agentWith(false), pages).length, 0);
    assert.deepEqual(createReadWebPageTools(agentWith(true), pages).map((tool) => tool.name), ["read_web_page"]);
  });

  it("reads a page in pages from the offset", async () => {
    const { pages } = countingPages("a".repeat(30_000) + "tail");
    const [tool] = createReadWebPageTools(agentWith(true), pages);

    const first = await tool.handler({ url: PAGE, offset: 0 });
    const next = await tool.handler({ url: PAGE, offset: 30_000 });

    assert.match(first.text, /continue with offset 30000/);
    assert.match(next.text, /^tail\n\n\[end, 30004 chars\]$/);
  });

  it("downloads a page once per run, whichever tool reads it", async () => {
    const { pages, downloads } = countingPages("Eligibility response rules");
    const [read] = createReadWebPageTools(agentWith(true), pages);
    const [fetch] = createFetchDocumentTools({ adoId: 1, agentId: "better-research", taskId: "AT-1-001", runId: 9, urls: [PAGE] }, pages);

    await read.handler({ url: PAGE, offset: 0 });
    await fetch.handler({ url: PAGE, offset: 0 });
    await read.handler({ url: `${PAGE}#page=2`, offset: 0 });

    assert.equal(downloads(), 1);
  });

  it("answers a page it can't read as an error, without caching it", async () => {
    let attempts = 0;
    const pages = new WebPageTexts(async () => {
      attempts++;

      return { ok: false, error: "HTTP 403" };
    });
    const [tool] = createReadWebPageTools(agentWith(true), pages);

    const result = await tool.handler({ url: PAGE, offset: 0 });
    await tool.handler({ url: PAGE, offset: 0 });

    assert.equal(result.isError, true);
    assert.equal(result.text, `${PAGE} couldn't be read: HTTP 403.`);
    assert.equal(attempts, 2);
  });

  it("refuses a page that isn't on the public web", async () => {
    const [tool] = createReadWebPageTools(agentWith(true), new WebPageTexts());

    const result = await tool.handler({ url: "http://127.0.0.1:8080/admin", offset: 0 });

    assert.equal(result.isError, true);
    assert.match(result.text, /isn't on the public web/);
  });
});
