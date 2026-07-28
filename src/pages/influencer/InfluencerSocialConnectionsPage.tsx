import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Clock, Link2, RefreshCw, ShieldOff } from "lucide-react";

interface Connection {
  id: string;
  provider: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  granted_scopes: string[] | null;
  missing_scopes: string[] | null;
  required_scopes: string[] | null;
  token_expires_at: string | null;
  last_validation_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface ConnEvent {
  id: string;
  connection_id: string | null;
  provider: string | null;
  event_type: string;
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
  revoked: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
  disconnected: "bg-muted text-muted-foreground",
  error: "bg-red-100 text-red-800",
  pending: "bg-muted text-muted-foreground",
};

const AVAILABLE_PROVIDERS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
];

function expiryWarning(expiresAt: string | null): { level: "ok" | "soon" | "expired"; label: string } {
  if (!expiresAt) return { level: "ok", label: "No expiry" };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { level: "expired", label: "Expired" };
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 7) return { level: "soon", label: `Expires in ${days}d` };
  return { level: "ok", label: `Expires in ${days}d` };
}

export default function InfluencerSocialConnectionsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<ConnEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase
        .from("social_connections")
        .select("id,provider,username,display_name,avatar_url,status,granted_scopes,missing_scopes,required_scopes,token_expires_at,last_validation_at,last_sync_at,error_message,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("social_connection_events")
        .select("id,connection_id,provider,event_type,payload,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setConnections((c ?? []) as Connection[]);
    setEvents((e ?? []) as ConnEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const connectedIds = useMemo(() => new Set(connections.map((c) => c.provider)), [connections]);

  const connect = async (providerId: string) => {
    const { data, error } = await supabase.functions.invoke("social-oauth", {
      body: { provider: providerId, redirectPath: "/influencer/social" },
    });
    if (error) {
      toast({ title: "Could not start OAuth", description: error.message, variant: "destructive" });
      return;
    }
    const url = (data as { authUrl?: string } | null)?.authUrl;
    if (url) window.location.href = url;
  };

  const revalidate = async (c: Connection) => {
    setBusyId(c.id);
    const { error } = await supabase.functions.invoke("social-token-refresh", {
      body: { connectionId: c.id, force: true },
    });
    setBusyId(null);
    if (error) toast({ title: "Revalidation failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Revalidation started" });
      load();
    }
  };

  const disconnect = async (c: Connection) => {
    if (!confirm(`Disconnect ${c.provider}?`)) return;
    setBusyId(c.id);
    const { error } = await supabase.functions.invoke("social-token-refresh", {
      body: { connectionId: c.id, action: "disconnect" },
    });
    setBusyId(null);
    if (error) toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Disconnected" });
      load();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Connections</h1>
          <p className="text-muted-foreground">Manage the platforms you post from, monitor tokens, and see sync history.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Available platforms</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {AVAILABLE_PROVIDERS.map((p) => (
            <Button key={p.id} variant={connectedIds.has(p.id) ? "outline" : "default"} onClick={() => connect(p.id)}>
              <Link2 className="h-4 w-4 mr-2" />
              {connectedIds.has(p.id) ? `Reconnect ${p.label}` : `Connect ${p.label}`}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">Connected platforms</TabsTrigger>
          <TabsTrigger value="history">Sync history</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : connections.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No platforms connected yet. Pick one above to get started.</CardContent></Card>
          ) : (
            connections.map((c) => {
              const warn = expiryWarning(c.token_expires_at);
              return (
                <Card key={c.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize">{c.provider}</span>
                            <Badge className={STATUS_TONE[c.status] ?? ""}>{c.status}</Badge>
                            {warn.level === "expired" && <Badge variant="destructive">Token expired</Badge>}
                            {warn.level === "soon" && <Badge className="bg-amber-100 text-amber-800">{warn.label}</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{c.display_name ?? c.username ?? "—"}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => revalidate(c)}>
                          <RefreshCw className="h-4 w-4 mr-1" /> Revalidate
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busyId === c.id} onClick={() => disconnect(c)}>
                          <ShieldOff className="h-4 w-4 mr-1" /> Disconnect
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="font-medium mb-1">Permissions</div>
                        <div className="flex flex-wrap gap-1">
                          {(c.granted_scopes ?? []).map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                          {(c.granted_scopes ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Missing</div>
                        <div className="flex flex-wrap gap-1">
                          {(c.missing_scopes ?? []).map((s) => (
                            <Badge key={s} variant="destructive" className="text-[10px]">{s}</Badge>
                          ))}
                          {(c.missing_scopes ?? []).length === 0 && <span className="text-muted-foreground">All granted</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Token: {warn.label}</div>
                        <div className="text-muted-foreground">Last validation: {c.last_validation_at ? new Date(c.last_validation_at).toLocaleString() : "never"}</div>
                        <div className="text-muted-foreground">Last sync: {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "never"}</div>
                      </div>
                    </div>

                    {c.error_message && (
                      <div className="text-xs text-red-600 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5" /> {c.error_message}
                      </div>
                    )}
                    {c.status === "connected" && !c.error_message && (
                      <div className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Healthy
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                {events.map((ev) => (
                  <div key={ev.id} className="flex gap-2 border-b py-1">
                    <span className="text-muted-foreground w-40 shrink-0">{new Date(ev.created_at).toLocaleString()}</span>
                    <span className="w-48 shrink-0">{ev.event_type}</span>
                    <span className="w-20 shrink-0 capitalize">{ev.provider ?? "—"}</span>
                  </div>
                ))}
                {events.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
