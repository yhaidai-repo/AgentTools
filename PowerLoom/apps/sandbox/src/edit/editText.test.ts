import assert from "node:assert/strict";
import { test } from "node:test";
import { editText } from "./editText";

test("replaces the one match and names its lines", () => {
  const edited = editText("a\nb\nc\n", "b", "x\ny", false);

  assert.ok(edited.ok);
  assert.equal(edited.value.content, "a\nx\ny\nc\n");
  assert.deepEqual(edited.value.applied, { count: 1, lines: [2, 3] });
});

test("refuses no match and several matches without replace_all", () => {
  const none = editText("a\n", "z", "y", false);
  const several = editText("a a\n", "a", "b", false);

  assert.match(none.ok ? "" : none.reason, /not found/);
  assert.match(several.ok ? "" : several.reason, /found 2 times/);
});

test("replace_all replaces every match", () => {
  const edited = editText("a a\n", "a", "b", true);

  assert.ok(edited.ok);
  assert.equal(edited.value.content, "b b\n");
  assert.equal(edited.value.applied.count, 2);
});

test("LF old text matches a CRLF file and the replacement gets CRLF", () => {
  const edited = editText("﻿one\r\ntwo\r\n", "one\ntwo", "1\n2", false);

  assert.ok(edited.ok);
  assert.equal(edited.value.content, "﻿1\r\n2\r\n");
});

test("refuses an empty or unchanged old text", () => {
  assert.equal(editText("a", "", "b", false).ok, false);
  assert.equal(editText("a", "a", "a", false).ok, false);
});
