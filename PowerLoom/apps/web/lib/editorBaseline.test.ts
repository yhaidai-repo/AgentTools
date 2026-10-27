import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { it } from "node:test";

// Isolated, offline browser fixture. No Next server, real actions or user data. Opt in for the installed Edge runtime.
it("all three editors preserve text/baseline pairs across conflict, failure, save and restore", { skip: process.env.POWERLOOM_BROWSER_TESTS !== "1" }, async () => {
  const require = createRequire(import.meta.url);
  const { build } = require("esbuild");
  const { chromium } = require("../../../../DevSecrets/DevHub/playwright-mcp/node_modules/playwright");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {SkillEditor} from './app/skills/[name]/SkillEditor'; import {TaskNotesForm} from './app/items/TaskNotesForm'; import {UserNotesForm} from './app/pbis/[adoId]/UserNotesForm';
      const root = createRoot(document.getElementById('root'));
      window.renderFixture = (kind,text,hash) => root.render(<React.Fragment><div key={kind} data-editor-kind={kind}>{kind === 'skill' ? <SkillEditor name="synthetic" content={text} hash={hash}/> : kind === 'task' ? <TaskNotesForm itemId="AT-synthetic" path="/unused" text={text}/> : <UserNotesForm adoId={1} text={text}/>}</div><textarea id="unrelated" defaultValue="Unrelated field"/></React.Fragment>);`, resolveDir: root, loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", alias: { "@": root }, define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "fake-actions", setup(builder: any) {
      builder.onResolve({ filter: /^\.\/actions$/ }, (args: any) => /SkillEditor|TaskNotesForm|UserNotesForm/.test(args.importer) ? { path: "actions", namespace: "fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `async function save(previous,form){window.submissions.push(Object.fromEntries(form));return window.nextOutcome;} export {save as saveSkill,save as saveTaskNotes,save as saveUserNotes};`, loader: "js" }));
    } }],
  });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext();
    await context.setOffline(true);
    const page = await context.newPage();
    await page.setContent('<!doctype html><div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const kind of ["skill", "task", "pbi"]) {
      const baseline = kind === "skill" ? "hash" : "loaded", field = kind === "skill" ? "content" : "text";
      const expected = (text: string, hash: string) => kind === "skill" ? hash : text;
      await page.evaluate((kind: string) => { (window as any).submissions = []; (window as any).nextOutcome = {ok:false,message:'Conflict: reload latest.'}; (window as any).renderFixture(kind, "ORIGINAL", "hash-original"); }, kind);
      const textarea = page.locator(`textarea[name="${field}"]`);
      await page.waitForFunction(({ kind, field, baseline, original }: { kind: string; field: string; baseline: string; original: string }) => {
        const editor = document.querySelector(`[data-editor-kind="${kind}"]`);
        return (editor?.querySelector(`textarea[name="${field}"]`) as HTMLTextAreaElement | null)?.value === "ORIGINAL"
          && (editor?.querySelector(`input[name="${baseline}"]`) as HTMLInputElement | null)?.value === original;
      }, { kind, field, baseline, original: expected("ORIGINAL", "hash-original") });
      await textarea.fill("LOCAL EDIT");
      await page.locator("#unrelated").fill("KEEP UNRELATED EDIT");
      await page.evaluate((kind: string) => (window as any).renderFixture(kind, "UNSEEN SERVER EDIT", "hash-unseen"), kind);
      await page.getByRole("button", { name: "Load latest", exact: true }).waitFor();
      assert.equal(await textarea.inputValue(), "LOCAL EDIT");
      assert.equal(await page.locator(`input[name="${baseline}"]`).inputValue(), expected("ORIGINAL", "hash-original"));
      await page.getByRole("button", { name: kind === "skill" ? "Save skill" : "Save notes", exact: true }).click();
      await page.waitForFunction(() => (window as any).submissions.length === 1);
      const refused = await page.evaluate(() => (window as any).submissions[0]);
      assert.equal(refused[field], "LOCAL EDIT");
      assert.equal(refused[baseline], expected("ORIGINAL", "hash-original"));
      assert.equal(await textarea.inputValue(), "LOCAL EDIT");
      assert.equal(await page.locator("#unrelated").inputValue(), "KEEP UNRELATED EDIT");
      await page.getByRole("button", { name: "Load latest", exact: true }).click();
      assert.equal(await textarea.inputValue(), "UNSEEN SERVER EDIT");
      assert.equal(await page.locator(`input[name="${baseline}"]`).inputValue(), expected("UNSEEN SERVER EDIT", "hash-unseen"));
      await textarea.fill("RECENT SAVED TEXT");
      await page.evaluate(() => { (window as any).nextOutcome = {ok:true,message:'Saved.'}; });
      await page.getByRole("button", { name: kind === "skill" ? "Save skill" : "Save notes", exact: true }).click();
      await page.waitForFunction(() => (window as any).submissions.length === 2);
      await page.evaluate((kind: string) => (window as any).renderFixture(kind, "RECENT SAVED TEXT", "hash-saved"), kind);
      await page.waitForFunction(({ name, value }: { name: string; value: string }) => (document.querySelector(`input[name="${name}"]`) as HTMLInputElement).value === value, { name: baseline, value: expected("RECENT SAVED TEXT", "hash-saved") });
      await page.evaluate((kind: string) => (window as any).renderFixture(kind, "RESTORED OLD REVISION", "hash-restored"), kind);
      await page.waitForFunction((field: string) => (document.querySelector(`textarea[name="${field}"]`) as HTMLTextAreaElement).value === "RESTORED OLD REVISION", field);
      await page.getByRole("button", { name: kind === "skill" ? "Save skill" : "Save notes", exact: true }).click();
      await page.waitForFunction(() => (window as any).submissions.length === 3);
      const restored = await page.evaluate(() => (window as any).submissions[2]);
      assert.equal(restored[field], "RESTORED OLD REVISION");
      assert.equal(restored[baseline], expected("RESTORED OLD REVISION", "hash-restored"));
      assert.equal(await page.locator("#unrelated").inputValue(), "KEEP UNRELATED EDIT");
    }
  } finally { await browser.close(); }
});
