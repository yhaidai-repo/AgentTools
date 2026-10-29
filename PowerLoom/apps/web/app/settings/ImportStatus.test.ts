import assert from "node:assert/strict";
import { it } from "node:test";
import React, { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportStatus } from "./ImportStatus";

function renderStatus(props: ComponentProps<typeof ImportStatus>): string {
  // Match the isolated JSX runner's React binding without changing Next's component compilation.
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    return renderToStaticMarkup(createElement(ImportStatus, props));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

it("hides the retired inbox source and its warning from an older saved status", () => {
  const now = new Date();
  const html = renderStatus({
    status: { configured: true, checkedAt: now.toISOString(), sources: [{ source: "outlook", waiting: 0, failed: 0 }, { source: "inbox", waiting: 0, failed: 0 }] },
    activity: [{ source: "outlook", lastImportAt: now, isQuiet: false }, { source: "inbox", lastImportAt: now, isQuiet: true }],
  });

  assert.match(html, /outlook/);
  assert.doesNotMatch(html, /inbox|is the source still running/);
});

it("keeps the warning for an inactive Outlook exporter", () => {
  const now = new Date();
  const html = renderStatus({
    status: { configured: true, checkedAt: now.toISOString(), sources: [{ source: "outlook", waiting: 2, failed: 1 }] },
    activity: [{ source: "outlook", lastImportAt: now, isQuiet: true }],
  });

  assert.match(html, /outlook/);
  assert.match(html, /is the source still running/);
});
