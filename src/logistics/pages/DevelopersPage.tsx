import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Copy, KeyRound, Plus, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db, SHIPMENT_STATUS } from "../lib/db";
import { useAccounts, useHubs } from "../lib/queries";
import { resolveAddress, toAddress } from "../lib/address";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import AddressField, { type AddressValue } from "../components/AddressField";
import { PageHeader } from "../components/common";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  default_hub_id: string | null;
  sender_name: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  scopes?: string[];
  allowed_ips?: string[];
  rate_limit_per_min?: number;
  expires_at?: string | null;
  created_at: string;
}
interface Hook {
  id: string;
  url: string;
  events: string[];
  api_key_id: string | null;
  is_active: boolean;
  description: string | null;
  secret: string;
  created_at: string;
}
interface Delivery {
  id: string;
  webhook_id: string;
  status_code: number | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/logistics-api/v1`;

const randomToken = (bytes: number) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => alphabet[b % alphabet.length]).join("");
};
const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const DevelopersPage: React.FC = () => {
  const { can, session } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const [newKey, setNewKey] = useState(false);
  const [newHook, setNewHook] = useState(false);
  const [revealed, setRevealed] = useState<{ title: string; value: string; note: string } | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["lx", "api-keys"],
    enabled: can("owner"),
    queryFn: async () => {
      const { data, error } = await db.from("logistics_api_keys").select("id, name, key_prefix, default_hub_id, sender_name, last_used_at, revoked_at, scopes, allowed_ips, rate_limit_per_min, expires_at, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiKey[];
    },
  });
  const { data: hooks = [] } = useQuery({
    queryKey: ["lx", "webhooks"],
    enabled: can("owner"),
    queryFn: async () => {
      const { data, error } = await db.from("logistics_webhooks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Hook[];
    },
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["lx", "webhook-deliveries"],
    enabled: can("owner") && hooks.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("logistics_webhook_deliveries").select("*").order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return (data ?? []) as Delivery[];
    },
  });

  if (!can("owner")) return <Navigate to="/" replace />;

  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast({ title: "Copied" }));

  const revoke = async (k: ApiKey) => {
    if (!window.confirm(`Revoke "${k.name}"? Integrations using it stop working immediately.`)) return;
    const { error } = await db.from("logistics_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", k.id);
    if (error) toast({ variant: "destructive", title: "Could not revoke", description: error.message });
    qc.invalidateQueries({ queryKey: ["lx", "api-keys"] });
  };

  const toggleHook = async (h: Hook, active: boolean) => {
    await db.from("logistics_webhooks").update({ is_active: active }).eq("id", h.id);
    qc.invalidateQueries({ queryKey: ["lx", "webhooks"] });
  };

  const deleteHook = async (h: Hook) => {
    if (!window.confirm(`Delete webhook ${h.url}?`)) return;
    await db.from("logistics_webhooks").delete().eq("id", h.id);
    qc.invalidateQueries({ queryKey: ["lx", "webhooks"] });
  };

  return (
    <div>
      <PageHeader title="Developers" description="Connect stores, ERPs and marketplaces to 1145 Logistics." />

      <section className="rounded-xl border bg-card mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> API keys
          </h2>
          <Button size="sm" onClick={() => setNewKey(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New key
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead className="hidden md:table-cell">Default hub</TableHead>
              <TableHead className="hidden md:table-cell">Last used</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No keys yet. Create one per integration so you can revoke them independently.
                </TableCell>
              </TableRow>
            )}
            {keys.map((k) => (
              <TableRow key={k.id} className={k.revoked_at ? "opacity-50" : undefined}>
                <TableCell className="font-medium">
                  {k.name}
                  <div className="text-xs font-normal text-muted-foreground">
                    {(k.scopes ?? []).join(", ")} · {k.rate_limit_per_min ?? 120}/min
                    {k.allowed_ips?.length ? ` · ${k.allowed_ips.length} IP rule${k.allowed_ips.length > 1 ? "s" : ""}` : " · any IP"}
                    {k.expires_at ? ` · expires ${format(new Date(k.expires_at), "d MMM yyyy")}` : ""}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{hubs.find((h) => h.id === k.default_hub_id)?.code ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {k.last_used_at ? `${formatDistanceToNowStrict(new Date(k.last_used_at))} ago` : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  {k.revoked_at ? (
                    <span className="text-xs text-muted-foreground">Revoked {format(new Date(k.revoked_at), "d MMM")}</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(k)}>
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border bg-card mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </h2>
          <Button size="sm" onClick={() => setNewHook(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add endpoint
          </Button>
        </div>
        <ul className="divide-y">
          {hooks.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No endpoints. Webhooks push every status change as it happens.</li>}
          {hooks.map((h) => {
            const recent = deliveries.filter((d) => d.webhook_id === h.id);
            const failures = recent.filter((d) => !d.status_code || d.status_code >= 300).length;
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm truncate">{h.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.events.includes("*") ? "All events" : h.events.join(", ")} ·{" "}
                    {h.api_key_id ? `Shipments from ${keys.find((k) => k.id === h.api_key_id)?.name ?? "key"}` : "All shipments"}
                    {recent.length > 0 && (
                      <span className={failures ? "text-red-600" : "text-emerald-600"}>
                        {" "}
                        · {recent.length - failures}/{recent.length} recent OK
                      </span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRevealed({ title: "Signing secret", value: h.secret, note: "Verify X-1145-Signature with HMAC-SHA256 over `${t}.${body}`." })}>
                  Secret
                </Button>
                <Switch checked={h.is_active} onCheckedChange={(v) => toggleHook(h, v)} aria-label="Active" />
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteHook(h)}>
                  Delete
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Quick start</h2>
        <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto">{`curl -X POST ${API_BASE}/shipments \\
  -H "Authorization: Bearer lx_live_…" \\
  -H "Idempotency-Key: order-1001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "ORDER-1001",
    "service_level": "next_day",
    "size": "medium",
    "recipient": { "name": "Thandi M", "phone": "0821234567" },
    "delivery_address": { "street": "22 Long St", "city": "Cape Town" }
  }'

GET  ${API_BASE}/shipments/LX…            # status + timeline
GET  ${API_BASE}/shipments?status=delivered
POST ${API_BASE}/shipments/LX…/cancel
POST ${API_BASE}/quote                    # price before booking`}</pre>
        <p className="text-xs text-muted-foreground mt-2">
          Webhook events: {Object.keys(SHIPMENT_STATUS).map((s) => `shipment.${s}`).join(", ")}, shipment.hub_scan.
        </p>
      </section>

      {newKey && (
        <NewKeyDialog
          hubs={hubs}
          userId={session?.user.id}
          onClose={() => setNewKey(false)}
          onCreated={(key) => {
            qc.invalidateQueries({ queryKey: ["lx", "api-keys"] });
            setRevealed({ title: "Your new API key", value: key, note: "Copy it now. For security it is never shown again." });
          }}
        />
      )}
      {newHook && (
        <NewHookDialog
          keys={keys.filter((k) => !k.revoked_at)}
          userId={session?.user.id}
          onClose={() => setNewHook(false)}
          onCreated={(secret) => {
            qc.invalidateQueries({ queryKey: ["lx", "webhooks"] });
            setRevealed({ title: "Signing secret", value: secret, note: "Use this to verify the X-1145-Signature header." });
          }}
        />
      )}

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{revealed?.title}</DialogTitle>
            <DialogDescription>{revealed?.note}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={revealed?.value ?? ""} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" onClick={() => revealed && copy(revealed.value)} aria-label="Copy">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const NewKeyDialog: React.FC<{
  hubs: Array<{ id: string; code: string; name: string }>;
  userId?: string;
  onClose: () => void;
  onCreated: (key: string) => void;
}> = ({ hubs, userId, onClose, onCreated }) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [hubId, setHubId] = useState("none");
  const [pickup, setPickup] = useState<AddressValue>({ text: "", coords: null });
  const [scopes, setScopes] = useState<string[]>(["shipments:read", "shipments:write", "quotes:read"]);
  const [ips, setIps] = useState("");
  const [rate, setRate] = useState("120");
  const [expires, setExpires] = useState("");
  const [accountId, setAccountId] = useState("none");
  const { data: accounts = [] } = useAccounts();
  const [saving, setSaving] = useState(false);
  const ipList = ips
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  const badIp = ipList.find((v) => !/^(\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?|[0-9a-f:]+)$/i.test(v));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Generated and hashed in the browser; only the hash is stored.
      const key = `lx_live_${randomToken(40)}`;
      const pickupAddress = pickup.text ? (pickup.coords ? toAddress(pickup.text, pickup.coords) : await resolveAddress(pickup.text)) : null;
      const { error } = await db.from("logistics_api_keys").insert({
        name: name.trim(),
        key_prefix: key.slice(0, 12),
        key_hash: await sha256Hex(key),
        default_hub_id: hubId === "none" ? null : hubId,
        sender_name: senderName || null,
        sender_phone: senderPhone || null,
        pickup_address: pickupAddress,
        scopes,
        account_id: accountId === "none" ? null : accountId,
        allowed_ips: ipList,
        rate_limit_per_min: Math.min(Math.max(Number(rate) || 120, 1), 6000),
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        created_by: userId,
      });
      if (error) throw error;
      onClose();
      onCreated(key);
    } catch (err) {
      toast({ variant: "destructive", title: "Could not create key", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
          <DialogDescription>Defaults apply when a request omits sender or pickup details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Shopify store" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sender name</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sender phone</Label>
              <Input type="tel" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Default pickup address</Label>
            <AddressField value={pickup} onChange={setPickup} placeholder="Warehouse or store address" />
          </div>
          <div className="space-y-1.5">
            <Label>Bill to account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account (pay per parcel)</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["shipments:read", "Read shipments"],
                ["shipments:write", "Create / cancel"],
                ["quotes:read", "Quotes"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setScopes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
                  className={`rounded-full border px-2.5 py-1 text-xs ${scopes.includes(v) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rate limit (req/min)</Label>
              <Input type="number" min={1} max={6000} value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Expires (optional)</Label>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Allowed IPs (optional)</Label>
            <Input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="203.0.113.10, 198.51.100.0/24" className="font-mono text-xs" />
            {badIp && <p className="text-xs text-destructive">"{badIp}" isn't an IP address or IPv4 CIDR.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Default hub</Label>
            <Select value={hubId} onValueChange={setHubId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nearest hub (automatic)</SelectItem>
                {hubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !scopes.length || !!badIp}>
              {saving ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const EVENT_OPTIONS = ["*", "awaiting_pickup", "picked_up", "at_hub", "out_for_delivery", "delivered", "failed_attempt", "returning", "returned", "cancelled", "exception"];

const NewHookDialog: React.FC<{ keys: ApiKey[]; userId?: string; onClose: () => void; onCreated: (secret: string) => void }> = ({
  keys,
  userId,
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [keyId, setKeyId] = useState("all");
  const [events, setEvents] = useState<string[]>(["*"]);
  const [saving, setSaving] = useState(false);

  const toggle = (ev: string) =>
    setEvents((cur) => {
      if (ev === "*") return ["*"];
      const next = cur.filter((e) => e !== "*");
      return next.includes(ev) ? next.filter((e) => e !== ev) : [...next, ev];
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const host = (() => {
      try {
        const u = new URL(url.trim());
        return u.protocol === "https:" ? u.hostname.toLowerCase() : null;
      } catch {
        return null;
      }
    })();
    if (!host) {
      toast({ variant: "destructive", title: "Use an https:// URL" });
      return;
    }
    if (/^(localhost|.*\.local|.*\.internal)$|^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^\[|:/.test(host)) {
      toast({ variant: "destructive", title: "Private addresses aren't allowed", description: "Webhooks must point to a public internet host." });
      return;
    }
    setSaving(true);
    const secret = `whsec_${randomToken(32)}`;
    const { error } = await db.from("logistics_webhooks").insert({
      url: url.trim(),
      secret,
      events: events.length ? events : ["*"],
      api_key_id: keyId === "all" ? null : keyId,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Could not add endpoint", description: error.message });
      return;
    }
    onClose();
    onCreated(secret);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add webhook endpoint</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <Input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/1145" />
          </div>
          <div className="space-y-1.5">
            <Label>Shipments</Label>
            <Select value={keyId} onValueChange={setKeyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shipments</SelectItem>
                {keys.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    Only {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_OPTIONS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggle(ev)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${events.includes(ev) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                >
                  {ev === "*" ? "All events" : ev.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add endpoint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DevelopersPage;
