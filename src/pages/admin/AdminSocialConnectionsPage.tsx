import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";

interface Connection {
  id: string;
  user_id: string;
  provider: string;
  username: string | null;
  display_name: string | null;
  status: string;
  granted_scopes: string[] | null;
  missing_scopes: string[] | null;
  token_expires_at: string | null;
  last_validation_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface ConnEvent {
  id: string;
  connection_id: string | null;
  user_id: string | null;
  provider: string | null;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  connected: "bg-green-100 text-green-800",
  validating: "bg-blue-100 text-blue-800",
  authenticating: "bg-blue-100 text-blue-800",
  awaiting_permissions: "bg-amber-100 text-amber-800",
  permission_missing: "bg-amber-100 text-amber-800",
  token_expired: "bg-orange-100 text-orange-800",
  suspended: "bg-orange-100 text-orange-800",
  revoked: "bg-red-100 text-red-800",
  disconnected: "bg-muted text-muted-foreground",
  error: "bg-red-100 text-red-800",
  pending: "bg-muted text-muted-foreground",
};

const FAIL_EVENTS = new Set([
  "authentication_failed",
  "permission_missing",
  "permission_revoked",
  "ownership_mismatch",
  "read_test_failed",
  "publish_capability_missing",
  "token_refresh_failed",
  "post_failed",
  "webhook_rejected",
]);

export default function AdminSocialConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<ConnEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase
        .from("social_connections")
        .select("id,user_id,provider,username,display_name,status,granted_scopes,missing_scopes,token_expires_at,last_validation_at,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("social_connection_events")
        .select("id,connection_id,user_id,provider,event_type,actor,payload,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setConnections((c ?? []) as Connection[]);
    setEvents((e ?? []) as ConnEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const failedAuth = useMemo(
    () => events.filter((ev) => FAIL_EVENTS.has(ev.event_type)).slice(0, 100),
    [events],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(
      (c) =>
        c.provider.toLowerCase().includes(q) ||
        (c.username ?? "").toLowerCase().includes(q) ||
        (c.display_name ?? "").toLowerCase().includes(q) ||
        c.user_id.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    );
  }, [connections, search]);

  const forceRevalidate = async (conn: Connection) => {
    setBusyId(conn.id);
    const { error } = await supabase.functions.invoke("social-token-refresh", {
      body: { connectionId: conn.id, force: true },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Revalidate failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Revalidation queued", description: `${conn.provider} — ${conn.username ?? conn.user_id}` });
      load();
    }
  };

  const revoke = async (conn: Connection) => {
    if (!confirm(`Revoke ${conn.provider} connection for ${conn.username ?? conn.user_id}? Tokens will be wiped.`)) return;
    setBusyId(conn.id);
    const { error } = await supabase.functions.invoke("social-token-refresh", {
      body: { connectionId: conn.id, action: "revoke", reason: "admin_revoked" },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Connection revoked", description: `${conn.provider} — ${conn.username ?? conn.user_id}` });
      load();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Connections</h1>
          <p className="text-muted-foreground">Review failures, inspect permissions, revalidate, and revoke.</p>
        </div>
        <Button onClick={load} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{connections.length}</div><div className="text-sm text-muted-foreground">Total connections</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{connections.filter(c => c.status === "connected").length}</div><div className="text-sm text-muted-foreground">Connected</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{connections.filter(c => ["permission_missing","token_expired","suspended"].includes(c.status)).length}</div><div className="text-sm text-muted-foreground">Needs attention</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{connections.filter(c => ["revoked","error"].includes(c.status)).length}</div><div className="text-sm text-muted-foreground">Revoked / errored</div></CardContent></Card>
      </div>

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="failures">Failed authentications ({failedAuth.length})</TabsTrigger>
          <TabsTrigger value="events">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-3">
          <Input placeholder="Search by provider, user, status…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <Card key={c.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{c.provider}</span>
                          <Badge className={STATUS_TONE[c.status] ?? ""}>{c.status}</Badge>
                        </div>
                        <div className="text-sm">{c.display_name ?? c.username ?? "—"} <span className="text-muted-foreground">({c.username ?? "no username"})</span></div>
                        <div className="text-xs text-muted-foreground">user_id: {c.user_id}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => forceRevalidate(c)}>
                          <RefreshCw className="h-4 w-4 mr-1" /> Revalidate
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busyId === c.id} onClick={() => revoke(c)}>
                          <ShieldOff className="h-4 w-4 mr-1" /> Revoke
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="font-medium">Granted scopes</div>
                        <div className="text-muted-foreground break-all">{(c.granted_scopes ?? []).join(", ") || "—"}</div>
                      </div>
                      <div>
                        <div className="font-medium">Missing scopes</div>
                        <div className="text-red-600 break-all">{(c.missing_scopes ?? []).join(", ") || "—"}</div>
                      </div>
                      <div>
                        <div className="font-medium">Token expires</div>
                        <div className="text-muted-foreground">{c.token_expires_at ?? "—"}</div>
                      </div>
                      <div>
                        <div className="font-medium">Last validation</div>
                        <div className="text-muted-foreground">{c.last_validation_at ?? "—"}</div>
                      </div>
                    </div>
                    {c.error_message && (
                      <div className="text-xs text-red-600 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5" /> {c.error_message}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && <p className="text-muted-foreground text-sm">No connections match.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="failures">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent failure events</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {failedAuth.map((ev) => (
                  <div key={ev.id} className="border rounded p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{ev.event_type}</Badge>
                      <span className="text-muted-foreground">{ev.provider ?? "—"}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(ev.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      conn: {ev.connection_id ?? "—"} · user: {ev.user_id ?? "—"} · actor: {ev.actor}
                    </div>
                    {Object.keys(ev.payload ?? {}).length > 0 && (
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(ev.payload, null, 2)}</pre>
                    )}
                  </div>
                ))}
                {failedAuth.length === 0 && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> No recent failures.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader><CardTitle className="text-base">Latest events (300)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                {events.map((ev) => (
                  <div key={ev.id} className="flex gap-2 border-b py-1">
                    <span className="text-muted-foreground w-40 shrink-0">{new Date(ev.created_at).toLocaleString()}</span>
                    <span className="w-48 shrink-0">{ev.event_type}</span>
                    <span className="w-20 shrink-0">{ev.provider ?? "—"}</span>
                    <span className="text-muted-foreground truncate">{ev.connection_id ?? ev.user_id ?? ""}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
