import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Copy, KeyRound, Plus, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { isPublicHttpsUrl, randomToken, sha256Hex } from "../lib/crypto";
import { PageHeader } from "../components/common";
import { usePortal } from "./PortalApp";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/logistics-api/v1`;

const PortalDevelopers: React.FC = () => {
  const { account } = usePortal();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [keyName, setKeyName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [hookKey, setHookKey] = useState("");

  const { data: keys = [] } = useQuery({
    queryKey: ["portal", account.id, "keys"],
    queryFn: async () =>
      ((await db.from("logistics_api_keys").select("id, name, key_prefix, last_used_at, revoked_at, scopes").eq("account_id", account.id).order("created_at", { ascending: false })).data ??
        []) as Array<{ id: string; name: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; scopes: string[] }>,
  });
  const liveKeys = keys.filter((k) => !k.revoked_at);
  const { data: hooks = [] } = useQuery({
    queryKey: ["portal", account.id, "hooks", liveKeys.map((k) => k.id).join(",")],
    enabled: keys.length > 0,
    queryFn: async () =>
      ((await db.from("logistics_webhooks").select("id, url, is_active, api_key_id, secret").in("api_key_id", keys.map((k) => k.id))).data ?? []) as Array<{
        id: string;
        url: string;
        is_active: boolean;
        api_key_id: string;
        secret: string;
      }>,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal", account.id] });

  const createKey = async () => {
    const key = `lx_live_${randomToken(40)}`;
    const { error } = await db.from("logistics_api_keys").insert({
      name: keyName.trim() || "Integration",
      key_prefix: key.slice(0, 12),
      key_hash: await sha256Hex(key),
      account_id: account.id,
      sender_name: account.name,
    });
    if (error) {
      toast({ variant: "destructive", title: "Could not create key", description: error.message });
      return;
    }
    setKeyName("");
    setSecret({ title: "Your new API key (shown once)", value: key });
    refresh();
  };

  const revoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke "${name}"? Integrations using it stop immediately.`)) return;
    await db.from("logistics_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };

  const addHook = async () => {
    if (!isPublicHttpsUrl(hookUrl)) {
      toast({ variant: "destructive", title: "Use a public https:// URL" });
      return;
    }
    const keyId = hookKey || liveKeys[0]?.id;
    if (!keyId) {
      toast({ variant: "destructive", title: "Create an API key first" });
      return;
    }
    const s = `whsec_${randomToken(32)}`;
    const { error } = await db.from("logistics_webhooks").insert({ url: hookUrl.trim(), secret: s, api_key_id: keyId, events: ["*"] });
    if (error) {
      toast({ variant: "destructive", title: "Could not add endpoint", description: error.message });
      return;
    }
    setHookUrl("");
    setSecret({ title: "Webhook signing secret", value: s });
    refresh();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="API & webhooks" description="Connect your store, ERP or marketplace. Shipments created with these keys are billed to this account." />

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> API keys
        </h2>
        <div className="flex gap-2">
          <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name, e.g. Shopify store" className="sm:w-72" />
          <Button onClick={createKey}>
            <Plus className="h-4 w-4 mr-1.5" /> Create key
          </Button>
        </div>
        <ul className="divide-y rounded-lg border">
          {keys.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No keys yet.</li>}
          {keys.map((k) => (
            <li key={k.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${k.revoked_at ? "opacity-50" : ""}`}>
              <span className="font-medium">{k.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {k.revoked_at ? "revoked" : k.last_used_at ? `used ${formatDistanceToNowStrict(new Date(k.last_used_at))} ago` : "never used"}
              </span>
              {!k.revoked_at && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(k.id, k.name)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhooks
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://your-store.com/webhooks/1145" className="flex-1" />
          {liveKeys.length > 1 && (
            <select value={hookKey} onChange={(e) => setHookKey(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {liveKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={addHook} disabled={!liveKeys.length}>
            Add endpoint
          </Button>
        </div>
        <ul className="divide-y rounded-lg border">
          {hooks.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No endpoints. Status changes are pushed to them in real time.</li>}
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs truncate flex-1">{h.url}</span>
              <Button size="sm" variant="ghost" onClick={() => setSecret({ title: "Webhook signing secret", value: h.secret })}>
                Secret
              </Button>
              <Switch
                checked={h.is_active}
                onCheckedChange={async (v) => {
                  await db.from("logistics_webhooks").update({ is_active: v }).eq("id", h.id);
                  refresh();
                }}
                aria-label="Active"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Quick start</h2>
        <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto">{`POST ${API_BASE}/shipments
Authorization: Bearer lx_live_…
Idempotency-Key: <your order id>

{ "reference": "ORDER-1001", "service_level": "next_day", "parcel_count": 2,
  "recipient": { "name": "Thandi M", "phone": "0821234567" },
  "delivery_address": { "street": "22 Long St", "city": "Cape Town" } }

GET  ${API_BASE}/shipments/LX…        GET ${API_BASE}/shipments/LX…/pod
GET  ${API_BASE}/pickup-points
POST ${API_BASE}/shipments/LX…/return POST ${API_BASE}/shipments/LX…/cancel`}</pre>
        <p className="text-xs text-muted-foreground mt-2">Webhooks are signed: verify X-1145-Signature (t=…, v1=HMAC-SHA256 of "t.body" with your secret).</p>
      </section>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
            <DialogDescription>Store it in your server's secret manager. Never put it in a browser or app.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={secret?.value ?? ""} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" aria-label="Copy" onClick={() => secret && navigator.clipboard?.writeText(secret.value).then(() => toast({ title: "Copied" }))}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalDevelopers;
