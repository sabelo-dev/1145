import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../supabase/functions/_shared/webhookSignature.ts";

const key = Buffer.from("test-signing-key-0123456789abcdef");
const secret = `whsec_${key.toString("base64")}`;
const body = JSON.stringify({ user: { email: "a@example.com" } });
const now = () => String(Math.floor(Date.now() / 1000));
const sign = (id: string, ts: string, payload: string) =>
 createHmac("sha256", key).update(`${id}.${ts}.${payload}`).digest("base64");
const headers = (prefix: string, id: string, ts: string, sig: string) =>
 new Headers({ [`${prefix}-id`]: id, [`${prefix}-timestamp`]: ts, [`${prefix}-signature`]: sig });

test("accepts a valid Standard Webhooks signature with a Supabase-style secret", async () => {
 const ts = now();
 assert.equal(await verifyWebhookSignature(`v1,${secret}`, headers("webhook", "msg_1", ts, `v1,${sign("msg_1", ts, body)}`), body, "webhook"), null);
});
test("accepts a valid Svix signature among several during key rotation", async () => {
 const ts = now();
 const sig = `v1,b2xkc2lnbmF0dXJl v1,${sign("msg_2", ts, body)}`;
 assert.equal(await verifyWebhookSignature(secret, headers("svix", "msg_2", ts, sig), body, "svix"), null);
});
test("rejects a tampered body", async () => {
 const ts = now();
 const h = headers("webhook", "msg_3", ts, `v1,${sign("msg_3", ts, body)}`);
 assert.equal(await verifyWebhookSignature(secret, h, body.replace("a@", "b@"), "webhook"), "signature mismatch");
});
test("rejects a stale timestamp (replay)", async () => {
 const ts = String(Math.floor(Date.now() / 1000) - 3600);
 const h = headers("webhook", "msg_4", ts, `v1,${sign("msg_4", ts, body)}`);
 assert.equal(await verifyWebhookSignature(secret, h, body, "webhook"), "stale timestamp");
});
test("rejects missing headers and headers under the other prefix", async () => {
 const ts = now();
 assert.equal(await verifyWebhookSignature(secret, new Headers(), body, "webhook"), "missing signature headers");
 const h = headers("svix", "msg_5", ts, `v1,${sign("msg_5", ts, body)}`);
 assert.equal(await verifyWebhookSignature(secret, h, body, "webhook"), "missing signature headers");
});
