import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  CreditCard,
  Camera,
  MessageSquare,
  Package,
  Coins,
  Truck,
} from "lucide-react";
import { useOrderWorkflow } from "@/hooks/useOrderWorkflow";

const iconFor = (eventType: string) => {
  if (eventType.startsWith("payment")) return CreditCard;
  if (eventType === "ucoin_applied") return Coins;
  if (eventType === "notification_sent") return MessageSquare;
  if (eventType === "media_upload") return Camera;
  if (eventType === "tracking_added") return Truck;
  if (eventType === "order_placed") return Package;
  return CheckCircle2;
};

interface OrderTimelineProps {
  orderId: string;
  showMessages?: boolean;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ orderId, showMessages = false }) => {
  const { events, notifications, loading } = useOrderWorkflow(orderId);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4 min-w-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order progress</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <ol className="relative space-y-5 pl-6">
              <span className="absolute left-[9px] top-2 bottom-2 w-px bg-border" aria-hidden />
              {events.map((event, index) => {
                const Icon = iconFor(event.event_type);
                const isLast = index === events.length - 1;
                return (
                  <li key={event.id} className="relative min-w-0">
                    <span
                      className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                        isLast ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground break-words">{event.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(event.created_at).toLocaleString("en-ZA")}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {showMessages && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages have been sent for this order.</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">{n.channel}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.recipient}</p>
                  {n.error && <p className="text-xs text-destructive break-words">{n.error}</p>}
                </div>
                <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "secondary"}>
                  {n.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderTimeline;
