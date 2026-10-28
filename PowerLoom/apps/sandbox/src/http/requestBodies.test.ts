import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequest } from "./BadRequest";
import { openRequest } from "./requestBodies";

test("an open takes the vault's image name, and none when it isn't sent", () => {
  assert.deepEqual(openRequest({ owner: "powerloom-run-7", ttlMinutes: 30, image: "java" }), { owner: "powerloom-run-7", ttlMinutes: 30, image: "java" });
  assert.equal(openRequest({ owner: "powerloom-run-7", ttlMinutes: 30 }).image, undefined);
});

test("an open without an owner is a bad request", () => {
  assert.throws(() => openRequest({ ttlMinutes: 30 }), BadRequest);
});
