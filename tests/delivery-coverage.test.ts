import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageLabel, deliversTo, provincesOf, withProvinces } from "../src/lib/deliveryCoverage.ts";

test("an unrestricted merchant delivers everywhere", () => {
  assert.equal(deliversTo([], "Gauteng"), true);
  assert.equal(deliversTo(null, "Limpopo"), true);
  assert.equal(coverageLabel([]), "Nationwide");
});

test("South Africa without provinces is nationwide", () => {
  assert.equal(deliversTo(["South Africa", "Kenya"], "Western Cape"), true);
  assert.equal(coverageLabel(["South Africa"]), "Nationwide");
});

test("listing provinces limits delivery to them", () => {
  const regions = ["South Africa", "Gauteng", "Western Cape"];
  assert.equal(deliversTo(regions, "Gauteng"), true);
  assert.equal(deliversTo(regions, "gauteng"), true);
  assert.equal(deliversTo(regions, "KwaZulu-Natal"), false);
  assert.equal(deliversTo(regions), true);
  assert.equal(coverageLabel(regions), "Gauteng, Western Cape");
});

test("provinces alone imply South Africa", () => {
  assert.equal(deliversTo(["Free State"], "Free State"), true);
  assert.equal(deliversTo(["Free State"], "Gauteng"), false);
});

test("merchants that don't serve South Africa are excluded", () => {
  assert.equal(deliversTo(["Kenya", "Nigeria"]), false);
  assert.equal(deliversTo(["United Kingdom"], "Gauteng"), false);
  assert.equal(coverageLabel(["Kenya"]), null);
});

test("an unknown province never matches a restricted merchant", () => {
  assert.equal(deliversTo(["Gauteng"], "Atlantis"), false);
});

test("withProvinces swaps provinces and keeps countries", () => {
  assert.deepEqual(withProvinces(["Kenya", "Gauteng"], ["Western Cape"]), ["South Africa", "Kenya", "Western Cape"]);
  assert.deepEqual(withProvinces(["South Africa", "Gauteng"], []), ["South Africa"]);
  assert.deepEqual(provincesOf(withProvinces([], ["Limpopo", "Gauteng"])), ["Gauteng", "Limpopo"]);
});
