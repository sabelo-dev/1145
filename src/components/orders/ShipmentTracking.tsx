import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck, MapPin, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

interface Props {
  orderId: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Preparing your order",
  submitted: "Sent to the warehouse",
  awaiting_supplier_action: "Waiting on the warehouse",
  processing: "Being packed",
  shipped: "Shipped",
  in_transit: "On its way",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  supplier_failure: "Delayed — we are on it",
};

const prettify = (v?: string | null) =>
  v ? STATUS_LABEL[v] || v.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Preparing your order";

const ShipmentTracking: React.FC<Props> = ({ orderId }) => {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [job, setJob] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: fulfillments } = await supabase
        .from("dropship_fulfillments")
        .select("id, status, supplier_status, carrier, tracking_number, shipped_at, delivered_at, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      const ids = (fulfillments || []).map((f) => f.id);
      const [{ data: ev }, { data: dj }] = await Promise.all([
        ids.length
          ? supabase
              .from("dropship_tracking_events")
              .select("id, fulfillment_id, status, description, location, occurred_at")
              .in("fulfillment_id", ids)
              .order("occurred_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] } as any),
        supabase
          .from("delivery_jobs")
          .select("id, status, driver_id, delivery_address, estimated_delivery_time, actual_delivery_time")
          .eq("order_id", orderId)
          .maybeSingle(),
      ]);

      if (!active) return;
      setShipments(fulfillments || []);
      setEvents(ev || []);
      setJob(dj || null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [orderId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!shipments.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> Shipment tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {shipments.map((s) => {
          const list = events.filter((e) => e.fulfillment_id === s.id);
          return (
            <div key={s.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{prettify(s.status)}</Badge>
                {s.tracking_number && (
                  <span className="text-xs text-muted-foreground break-all">
                    {s.carrier || "Courier"} · {s.tracking_number}
                  </span>
                )}
              </div>

              {list.length > 0 && (
                <ol className="space-y-3 border-l pl-4">
                  {list.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-sm">{e.description || prettify(e.status)}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.location ? `${e.location} · ` : ""}
                        {e.occurred_at ? format(new Date(e.occurred_at), "d MMM yyyy, HH:mm") : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {!list.length && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Tracking updates appear here as soon as the parcel moves.
                </p>
              )}
            </div>
          );
        })}

        {job && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" /> Local delivery
            </p>
            <p className="text-sm text-muted-foreground">
              {job.status === "delivered" ? (
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Delivered</span>
              ) : job.driver_id ? (
                "A 1145 driver has your parcel."
              ) : (
                "Waiting for a 1145 driver to collect your parcel."
              )}
            </p>
            {job.delivery_address?.formatted && (
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="break-words">{job.delivery_address.formatted}</span>
              </p>
            )}
            {job.estimated_delivery_time && job.status !== "delivered" && (
              <p className="text-xs text-muted-foreground">
                Expected by {format(new Date(job.estimated_delivery_time), "d MMM yyyy")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShipmentTracking;
