import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertTriangle, MessageSquare, RefreshCw, CreditCard } from "lucide-react";

const money = (v: number) => `R${Number(v || 0).toFixed(2)}`;

const AdminOrderMonitoringPage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, n, p] = await Promise.all([
      supabase.from("order_events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("notification_log").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("order_payment_attempts").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setEvents((e.data as any[]) || []);
    setNotifications((n.data as any[]) || []);
    setPayments((p.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const failedMessages = notifications.filter((n) => n.status === "failed").length;
  const sentMessages = notifications.filter((n) => n.status === "sent").length;
  const failedPayments = payments.filter((p) => p.status === "failed").length;
  const deliveryRate = notifications.length
    ? Math.round((sentMessages / notifications.length) * 100)
    : 0;

  return (
    <div ref={ref} className="space-y-4 min-w-0">
      <SEO title="Order monitoring | 1145 Admin" description="Live view of order events, customer messages and payment attempts." />

      <div className="header-row">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">Order monitoring</h1>
          <p className="text-sm text-muted-foreground truncate">
            Every order step, message and payment attempt across the platform
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline sm:ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xl font-semibold">{events.length}</span>
            <span className="text-xs text-muted-foreground">Recent order steps</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xl font-semibold">{deliveryRate}%</span>
            <span className="text-xs text-muted-foreground">Messages delivered</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xl font-semibold">{failedMessages}</span>
            <span className="text-xs text-muted-foreground">Failed messages</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1">
            <CreditCard className="h-4 w-4 text-destructive" />
            <span className="text-xl font-semibold">{failedPayments}</span>
            <span className="text-xs text-muted-foreground">Failed payments</span>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Tabs defaultValue="events">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-3">
            <TabsTrigger value="events">Steps</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-4 space-y-2">
            {events.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground break-words">{e.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("en-ZA")}
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/orders/${e.order_id}/tracking`}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!events.length && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No order activity yet.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-4 space-y-2">
            {notifications.map((n) => (
              <Card key={n.id}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{n.channel} · {n.template || "update"}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.recipient}</p>
                    {n.error && <p className="text-xs text-destructive break-words">{n.error}</p>}
                  </div>
                  <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "secondary"}>
                    {n.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {!notifications.length && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No messages sent yet.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-2">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.gateway}{p.method ? ` · ${p.method}` : ""} — {money(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.reference || p.id}</p>
                    {p.error && <p className="text-xs text-destructive break-words">{p.error}</p>}
                  </div>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {!payments.length && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No payment attempts yet.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
});

AdminOrderMonitoringPage.displayName = "AdminOrderMonitoringPage";

export default AdminOrderMonitoringPage;
