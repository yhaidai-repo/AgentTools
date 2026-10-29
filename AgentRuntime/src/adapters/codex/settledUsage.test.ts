import assert from "node:assert/strict";
import { test } from "node:test";
import { SettledUsage } from "./settledUsage";

const usage = { input_tokens: 100, cached_input_tokens: 70, output_tokens: 8 };
const response = { type: "response_item", payload: { type: "custom_tool_call" } };
const ledger = { type: "token_usage_record", payload: { thread_token_usage: usage } };
const completed = { type: "response_item", payload: { type: "custom_tool_call_output" } };
const count = { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: usage } } };

test("accepts matching durable response usage and final cumulative count at a completed-item stop", () => {
  const evidence = new SettledUsage();
  for (const entry of [response, ledger, completed, count]) evidence.add(entry);
  assert.deepEqual(evidence.result(), { input: 100, cachedInput: 70, output: 8 });
});

test("refuses absent, corrupt, mismatched, invalid or followed-by-new-work usage", () => {
  for (const entries of [
    [count], [response, count], [response, ledger, completed],
    [response, ledger, count, {}], [response, ledger, count, response, count],
    [response, { ...ledger, payload: { thread_token_usage: { ...usage, output_tokens: 9 } } }, count],
    [response, { ...ledger, payload: { thread_token_usage: { ...usage, cached_input_tokens: 101 } } }, count],
    [{ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { ...usage, input_tokens: -100 } } } }, response, ledger, count],
  ]) {
    const evidence = new SettledUsage();
    for (const entry of entries) evidence.add(entry);
    assert.equal(evidence.result(), null);
  }
});
