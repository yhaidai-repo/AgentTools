import assert from "node:assert/strict";
import { it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeSeries } from "../components/charts/TimeSeries";
import { PerformanceCharts } from "../app/dashboard/application/PerformanceCharts";
import type { PerformanceHistory } from "./applicationPerformance";

function render(element: React.ReactElement): string {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try { return renderToStaticMarkup(element); }
  finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

it("draws measured zeros and isolates a missing interval instead of bridging downtime", () => {
  const html = render(createElement(TimeSeries, {
    title: "Requests", color: "cyan", format: String,
    points: [0, 2, null, 3].map((value, index) => ({ at: `2030-01-01T12:${String(index * 5).padStart(2, "0")}:00Z`, value, observedMinutes: value === null ? 0 : 1 })),
  }));
  assert.equal([...html.matchAll(/<polyline /g)].length, 2);
  assert.equal([...html.matchAll(/<circle /g)].length, 3);
  assert.match(html, /12:00 UTC · 0 · 1\/5 minutes observed/);
  assert.match(html, /12:15 UTC · 3 · 1\/5 minutes observed/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.doesNotThrow(() => render(createElement(TimeSeries, { title: "Empty", color: "cyan", format: String, points: [] })));
});

it("shows separate unavailable and collecting states, then labels all three metrics with their units", () => {
  assert.match(render(createElement(PerformanceCharts, { history: null })), /history is unavailable/);
  const history: PerformanceHistory = { from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z", intervalSeconds: 300, points: [] };
  assert.match(render(createElement(PerformanceCharts, { history })), /Collecting performance data/);
  history.points.push({ at: "2030-01-01T12:00:00Z", requestsPerMinute: 1.5, averageLatencyMs: 25, workingSetBytes: 104857600, observedMinutes: 2 });
  const html = render(createElement(PerformanceCharts, { history }));
  assert.match(html, /Requests per minute/);
  assert.match(html, /Average response time/);
  assert.match(html, /Memory use/);
  assert.match(html, /1.5\/min/);
  assert.match(html, /25 ms/);
  assert.match(html, /100 MiB/);
});
