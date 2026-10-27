import assert from "node:assert/strict";
import { it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StackedColumns } from "../components/charts/StackedColumns";
import { AGENT_METRICS } from "./agentMetrics";
import { formatUsd } from "./format";

function titles(format: (value: number) => string, values: number[], merged = false): string[] {
  // Next preserves JSX for its compiler; the isolated tsx runner uses the classic React binding instead.
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(StackedColumns, {
      title: "Synthetic chart", labels: ["2026-10-27"], format,
      series: values.map((value, index) => ({ key: String(index), label: index === 0 ? "Autotest" : "Design", color: merged ? "teal" : index === 0 ? "teal" : "blue", values: [value] })),
    }));
    return [...html.matchAll(/<title>(.*?)<\/title>/g)].map(match => match[1]);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

it("renders measured costs in each actual SVG tooltip, including combined segments", () => {
  assert.deepEqual(titles(AGENT_METRICS.cost.format, [12.5, 3.25]), ["2026-10-27 · Autotest: $12.50", "2026-10-27 · Design: $3.25"]);
  assert.deepEqual(titles(AGENT_METRICS.cost.format, [12.5, 3.25], true), ["2026-10-27 · Autotest / Design: $12.50 + $3.25"]);
  assert.equal(formatUsd(null), "Unknown");
  assert.equal(formatUsd(12.5, false), "Unknown");
});

it("preserves token, duration and run tooltips", () => {
  assert.deepEqual(titles(AGENT_METRICS.tokens.format, [1250, 25]), ["2026-10-27 · Autotest: 1.3k", "2026-10-27 · Design: 25"]);
  assert.deepEqual(titles(AGENT_METRICS.duration.format, [65000, 3000]), ["2026-10-27 · Autotest: 1m 5s", "2026-10-27 · Design: 3s"]);
  assert.deepEqual(titles(String, [12, 3]), ["2026-10-27 · Autotest: 12", "2026-10-27 · Design: 3"]);
});
