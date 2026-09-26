import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  status: string | null;
  title: string;
  description: string | null;
  actor: string;
  metadata: any;
  created_at: string;
}

export interface NotificationLogEntry {
  id: string;
  channel: string;
  recipient: string;
  template: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface PaymentAttempt {
  id: string;
  gateway: string;
  method: string | null;
  amount: number;
  status: string;
  reference: string | null;
  error: string | null;
  created_at: string;
}

export function useOrderWorkflow(orderId?: string) {
  const { toast } = useToast();
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationLogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [eventsRes, notifRes, payRes] = await Promise.all([
      supabase.from("order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      supabase.from("notification_log").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("order_payment_attempts").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    setEvents((eventsRes.data as any[]) || []);
    setNotifications((notifRes.data as any[]) || []);
    setPayments((payRes.data as any[]) || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-events-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${orderId}` },
        (payload) => setEvents((prev) => [...prev, payload.new as OrderEvent]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const notifyCustomer = useCallback(
    async (event: string, channels: string[] = ["sms", "whatsapp"]) => {
      if (!orderId) return false;
      setNotifying(true);
      try {
        const { data, error } = await supabase.functions.invoke("order-notify", {
          body: { orderId, event, channels },
        });
        if (error) throw error;
        const sent = (data?.results || []).filter((r: any) => r.status === "sent");
        if (sent.length) {
          toast({ title: "Update sent", description: `Sent by ${sent.map((r: any) => r.channel).join(" and ")}.` });
        } else {
          const first = (data?.results || [])[0];
          toast({
            variant: "destructive",
            title: "Nothing was sent",
            description: first?.error || "No message channel was available.",
          });
        }
        await load();
        return Boolean(sent.length);
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Could not send the update",
          description: err instanceof Error ? err.message : "Please try again.",
        });
        return false;
      } finally {
        setNotifying(false);
      }
    },
    [orderId, load, toast],
  );

  return { events, notifications, payments, loading, notifying, reload: load, notifyCustomer };
}
