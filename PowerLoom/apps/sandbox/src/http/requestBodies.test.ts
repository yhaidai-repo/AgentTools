import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequest } from "./BadRequest";
import { openRequest } from "./requestBodies";

test("an open takes the vault's image name and package cache, and none when they aren't sent", () => {
  const sent = openRequest({ owner: "powerloom-run-7", ttlMinutes: 30, image: "java", packageCache: "vault-a" });
  const bare = openRequest({ owner: "powerloom-run-7", ttlMinutes: 30 });

  assert.deepEqual(sent, { owner: "powerloom-run-7", ttlMinutes: 30, image: "java", packageCache: "vault-a" });
  assert.equal(bare.image, undefined);
  assert.equal(bare.packageCache, undefined);
});

test("an open without an owner is a bad request", () => {
  assert.throws(() => openRequest({ ttlMinutes: 30 }), BadRequest);
});
