import assert from "node:assert/strict";
import { test } from "node:test";
import { compareRelease } from "../src/lib/appRelease.ts";

const release = { versionCode: 5, versionName: "1.0.4" };

test("no prompt when the installed build is current or newer", () => {
  assert.equal(compareRelease(5, release), null);
  assert.equal(compareRelease(6, release), null);
});

test("an optional update for an older build", () => {
  assert.deepEqual(compareRelease(4, release), { required: false });
  assert.deepEqual(compareRelease(4, { ...release, minVersionCode: 4 }), { required: false });
});

test("a required update below minVersionCode", () => {
  assert.deepEqual(compareRelease(3, { ...release, minVersionCode: 4 }), { required: true });
});

test("a missing or malformed manifest entry is ignored", () => {
  assert.equal(compareRelease(1, undefined), null);
  assert.equal(compareRelease(1, { versionName: "x" } as never), null);
  assert.equal(compareRelease(NaN, release), null);
});
