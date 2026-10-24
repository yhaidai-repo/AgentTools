import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { documentUrl, pbiLinkedUrls } from "@powerloom/core";
import { webDocumentsBlock } from "./webDocuments";

const NEWSLETTER = "https://www.cms.gov/training-education/medicare-learning-network/newsletter/mln-connects-newsletter-october-8-2026";
const CONFLUENCE = "https://x.atlassian.net/wiki/spaces/A/pages/1#Rules";

describe("web documents", () => {
  it("are one document per page, whatever the anchor; Confluence links keep theirs", () => {
    const pbi = { descriptionMd: `See ${NEWSLETTER}#_Toc242186227 and ${NEWSLETTER}#_toc242186227.`, acceptanceCriteriaMd: `Rules: ${CONFLUENCE}` };

    assert.deepEqual(pbiLinkedUrls(pbi), [NEWSLETTER, CONFLUENCE]);
    assert.equal(documentUrl(CONFLUENCE), CONFLUENCE);
  });

  it("are listed for an agent with web access, with how to save notes or ask the user", () => {
    const block = webDocumentsBlock({ adoId: 36971, agentId: "better-research", taskId: "AT-36971-001", runId: 9, urls: [NEWSLETTER] });

    assert.match(block, /^<web-documents>\n/);
    assert.match(block, /save_document_notes/);
    assert.match(block, /request_document/);
    assert.ok(block.includes(`- ${NEWSLETTER}\n</web-documents>`));
  });

  it("add nothing for an agent without web access or when every page is read", () => {
    assert.equal(webDocumentsBlock(null), "");
    assert.equal(webDocumentsBlock({ adoId: 36971, agentId: "better-research", taskId: "AT-36971-001", runId: 9, urls: [] }), "");
  });
});
