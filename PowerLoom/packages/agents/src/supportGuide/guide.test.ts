import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guideRequestBlock, guideRequestSchema, type GuideImage, type GuideReport } from "@powerloom/core";
import type { ToolDefinition } from "@agenttools/runtime";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import { guideProblems } from "./validation";
import { supportGuideTools } from "./toolPolicy";
import { buildGuidePackage } from "./package";

const request = guideRequestSchema.parse({ mode: "remote-url", url: "https://app.example.test", allowedOrigins: ["https://app.example.test"], audience: "Support", environment: "dev", permittedActions: "view", data: "demo", owner: "Support" });
const image: GuideImage = { id: "asset", name: "one.png", sha256: "abc", bytes: 3, width: 10, height: 10, caption: "Form", alt: "Form", source: "S2", sourceOwner: "powerloom-run-1", sourceCase: "demo", inspectedAt: "2026-10-29T00:00:00.000Z", buildIdentity: "unknown" };
function report(source: string): GuideReport {
  return { title: "Demo", status: "ready", summary: "Observed", markdown: "# Demo\n## Overview\nView the form.\n## Before you begin\nSupport access.\n## Procedure\n1. Open the form.\n![Form](images/one.png)\n## Confirm completion\nThe form is visible.", buildIdentity: "unknown", buildSource: source, releaseVerified: false, verifiedAt: "2026-10-29T00:00:00.000Z", configuration: "Support/en/1280x720", workflows: [{ id: "one", title: "View", state: "observed", steps: ["Open"], expected: "Form", observed: "Form visible", source, images: ["one.png"] }], rules: [], blockers: [], verification: "Observed form." };
}
const metadata = { tool: "browser_snapshot", resultText: "- Page URL: https://app.example.test\n- Form", fresh: true };
describe("guide readiness and handoff", () => {
  it("rejects S0, non-browser input text and restored browser evidence", () => {
    const log = new ReadLog("- Page URL: https://app.example.test");
    const fake = log.add(metadata.resultText, { tool: "read_pbi", fresh: true, resultText: metadata.resultText });
    const old = log.add(metadata.resultText, { ...metadata, fresh: false });
    for (const source of ["S0", fake, old]) assert.ok(guideProblems(report(source), request, [image], log, image.sourceOwner).length);
  });
  it("accepts fresh browser evidence but rejects stale screenshots and unresolved workflows", () => {
    const log = new ReadLog("Task"), source = log.add(metadata.resultText, metadata);
    assert.deepEqual(guideProblems(report(source), request, [image], log, image.sourceOwner), []);
    assert.ok(guideProblems(report(source), request, [image], log, "powerloom-run-2").some(p => p.includes("Recapture")));
    const blocked = report(source); blocked.workflows[0].state = "blocked";
    assert.ok(guideProblems(blocked, request, [image], log, image.sourceOwner).length);
  });
  it("rejects external shortcut images even when a legitimate screenshot is present", () => {
    const log = new ReadLog("Task"), source = log.add(metadata.resultText, metadata), r = report(source);
    r.markdown += "\n![tracking]\n\n[tracking]: https://outside.example.test/pixel.png";
    assert.ok(guideProblems(r, request, [image], log, image.sourceOwner).some(p => p.includes("not approved")));
  });
  it("does not pass off a code-cache SHA as the build that actually ran", () => {
    const log = new ReadLog("Task"), browser = log.add(metadata.resultText, metadata);
    const local = { ...request, mode: "local-stack" as const, branch: "feature/demo", services: ["web"] }, r = report(browser);
    r.buildIdentity = "abc"; r.buildSource = browser;
    assert.ok(guideProblems(r, local, [{ ...image, buildIdentity: "abc" }], log, image.sourceOwner).some(p => p.includes("runtime build")));
    const identity = JSON.stringify({ repo: "a".repeat(40) + ";source=" + "b".repeat(64) });
    const statusText = "Phase: ready; running; yours; branch feature/demo\nStrict branch: true\nRuntime build identity: " + identity + "\n| web | running | https://app.example.test | - |";
    r.buildSource = log.add(statusText, { tool: "stack_status", resultText: statusText, fresh: true }); r.buildIdentity = identity;
    assert.deepEqual(guideProblems(r, local, [{ ...image, buildIdentity: identity }], log, image.sourceOwner), []);
    assert.ok(guideProblems(r, { ...local, url: "https://other.example.test", allowedOrigins: [...local.allowedOrigins, "https://other.example.test"] }, [{ ...image, buildIdentity: identity }], log, image.sourceOwner).some(p => p.includes("runtime build")));
  });
  it("keeps ready guide separate from destination readiness and generates a precise versioned update task", () => {
    const make = (destination: any) => buildGuidePackage({ packageId: "SG-1", taskId: "XT-1", runId: 1, pbiId: null, vault: "test", request: { ...request, destination }, guide: report("S1"), images: [image], contents: new Map([["asset", Buffer.from("png")]]), commits: {} });
    assert.equal(make({ action: "unspecified" }).publicationStatus, "awaiting-details");
    const pkg = make({ action: "update", site: "https://docs.example.test", space: "AA", title: "Demo", pageId: "123", version: 8, sections: "Procedure only" });
    assert.equal(pkg.publicationStatus, "pending");
    assert.match(pkg.files.find(f => f.path === "publish-task.md")!.text, /expected base version: 8/);
    assert.equal(pkg.files.some(f => f.path.includes("trace")), false);
  });
});
describe("tool provenance and remote boundaries", () => {
  it("records tool output separately from caller input, and restored sources are not fresh", async () => {
    const log = new ReadLog("Task"), tool = recordReads([{ name: "read_pbi", input: {}, description: "", handler: async () => ({ text: "Not a page" }) }], log)[0];
    const result = await tool.handler({ inject: "- Page URL: https://app.example.test" });
    assert.equal(log.find("S1")!.resultText, "Not a page");
    const restored = new ReadLog("Task"), replay = recordReads([tool], restored)[0];
    replay.restore!({}, result.text);
    assert.equal(restored.find("S1")!.fresh, false);
  });
  it("remote mode never offers stack start/stop and refuses foreign navigation", async () => {
    let calls = 0;
    const tools: ToolDefinition<any>[] = ["start_stack", "stop_stack", "browser_navigate"].map(name => ({ name, input: {}, description: "", handler: async () => { calls++; return { text: "- Page URL: https://app.example.test" }; } }));
    const allowed = supportGuideTools(tools, guideRequestBlock(request));
    assert.deepEqual(allowed.map(t => t.name), ["browser_navigate"]);
    assert.equal((await allowed[0].handler({ url: "https://outside.example.test" })).isError, true);
    assert.equal(calls, 0);
    assert.equal((await allowed[0].handler({ url: request.url })).isError, undefined);
  });
  it("forces strict branch resolution for local guide starts and rejects other services", async () => {
    let sent: any = null;
    const local = { ...request, mode: "local-stack" as const, branch: "feature/demo", services: ["web"] };
    const start = supportGuideTools([{ name: "start_stack", input: {}, description: "", handler: async value => { sent = value; return { text: "started" }; } }], guideRequestBlock(local))[0];
    await start.handler({ branch: local.branch, services: ["web"], strictBranch: false });
    assert.equal(sent.strictBranch, true);
    sent = null;
    assert.equal((await start.handler({ branch: local.branch, services: ["unrequested"] })).isError, true);
    assert.equal(sent, null);
  });
  it("invalid guide inputs expose no DevHub tools", () => assert.deepEqual(supportGuideTools([{ name: "start_stack", input: {}, description: "", handler: async () => ({ text: "" }) }], "missing"), []));
});
describe("media approval and claimed identity", () => {
  it("blocks ready for an unapproved derivative or a GIF without a static screenshot", () => {
    const log = new ReadLog("Task"), source = log.add(metadata.resultText, metadata);
    assert.ok(guideProblems(report(source), request, [{ ...image, approved: false }], log, image.sourceOwner).some(p => p.includes("approve_guide_image")));
    const gif = { ...image, name: "one.gif", mediaType: "image/gif" as const }, r = report(source);
    r.markdown = r.markdown.replace("images/one.png", "images/one.gif"); r.workflows[0].images = ["one.gif"];
    assert.ok(guideProblems(r, request, [gif], log, image.sourceOwner).some(p => p.includes("inspected screenshots")));
  });
  it("requires a remote identity and a named release to appear in the cited browser observation", () => {
    const log = new ReadLog("Task"), source = log.add(metadata.resultText, metadata);
    const footer = "- Page URL: https://app.example.test\nVersion 5.2.1", shown = log.add(footer, { ...metadata, resultText: footer });
    const claimed = { ...report(source), buildIdentity: "5.2.1", buildSource: source };
    assert.ok(guideProblems(claimed, request, [{ ...image, buildIdentity: "5.2.1" }], log, image.sourceOwner).some(p => p.includes("Remote identity")));
    assert.deepEqual(guideProblems({ ...claimed, buildSource: shown }, request, [{ ...image, buildIdentity: "5.2.1" }], log, image.sourceOwner), []);
    const released = { ...request, release: "5.2.1" }, verified = { ...claimed, buildSource: shown, releaseVerified: true };
    assert.ok(guideProblems(verified, released, [{ ...image, buildIdentity: "5.2.1" }], log, image.sourceOwner).some(p => p.includes("releaseSource")));
    assert.deepEqual(guideProblems({ ...verified, releaseSource: shown }, released, [{ ...image, buildIdentity: "5.2.1" }], log, image.sourceOwner), []);
  });
});
