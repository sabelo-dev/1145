// Till maths shown on screen (src/lib/posCart.ts) must agree with what
// pos_sale_create() charges; tests/pos.test.ts checks the database side.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addToCart, cartTotals, discountNeedsManager, percentOf, quickCash, setQuantity, tenderState, vatIncluded, type CartLine,
} from "../src/lib/posCart.ts";

const item = (key: string, price: number, extra: Partial<CartLine> = {}): Omit<CartLine, "quantity" | "discount_minor"> => ({
  key, product_id: key, variation_id: null, name: key, sku: null, list_price_minor: price, unit_price_minor: price, stock: null, ...extra,
});

test("adding the same item twice adds a unit; quantity 0 removes it", () => {
  let cart = addToCart([], item("mug", 10000));
  cart = addToCart(cart, item("mug", 10000));
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);
  assert.deepEqual(setQuantity(cart, "mug", 0), []);
});

test("lowering a quantity keeps the line discount within the line", () => {
  let cart = addToCart([], item("mug", 1000), 3);
  cart = cart.map((l) => ({ ...l, discount_minor: 2500 }));
  assert.equal(setQuantity(cart, "mug", 1)[0].discount_minor, 1000);
});

test("totals, discounts and inclusive VAT match the database's sums", () => {
  const cart = [
    { ...addToCart([], item("mug", 10000))[0] },
    { ...addToCart([], item("coffee", 3333), 3)[0] },
  ];
  const t = cartTotals(cart, 1000, 1500);
  assert.equal(t.total_minor, 18999);
  assert.equal(t.vat_minor, Math.round((18999 * 1500) / 11500));
  assert.equal(t.items, 4);
  assert.equal(vatIncluded(11500, 1500), 1500);
  assert.equal(cartTotals(cart, 1000, 0).vat_minor, 0);
});

test("a sale discount can't go below zero, and the limit test matches the database", () => {
  const cart = addToCart([], item("mug", 10000));
  assert.equal(cartTotals(cart, 50000, 0).total_minor, 0);
  assert.equal(discountNeedsManager(cartTotals(cart, 1000, 0), 1000), false);
  assert.equal(discountNeedsManager(cartTotals(cart, 1001, 0), 1000), true);
  // A manager's price change isn't a discount.
  const changed = cart.map((l) => ({ ...l, unit_price_minor: 5000 }));
  assert.equal(discountNeedsManager(cartTotals(changed, 0, 0), 1000), false);
  assert.equal(cartTotals(changed, 0, 0).discount_minor, 5000);
  assert.equal(percentOf(9999, 10), 1000);
});

test("tenders: change only from cash; split payments", () => {
  assert.deepEqual(tenderState(10000, [{ id: "1", method: "cash", amount_minor: 20000 }]),
    { cash_minor: 20000, noncash_minor: 0, due_minor: 0, change_minor: 10000, complete: true, problem: null });
  const short = tenderState(10000, [{ id: "1", method: "card", amount_minor: 6000 }]);
  assert.equal(short.due_minor, 4000);
  assert.equal(short.complete, false);
  assert.ok(tenderState(10000, [{ id: "1", method: "card", amount_minor: 12000 }]).problem);
  const split = tenderState(10000, [{ id: "1", method: "card", amount_minor: 6000 }, { id: "2", method: "cash", amount_minor: 5000 }]);
  assert.equal(split.change_minor, 1000);
  assert.equal(split.complete, true);
});

test("quick cash suggests the exact amount and round notes above it", () => {
  assert.deepEqual(quickCash(8550), [8550, 9000, 10000, 20000]);
  assert.deepEqual(quickCash(10000), [10000, 20000]);
  assert.deepEqual(quickCash(0), []);
});
