import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, BellOff, Loader2, Maximize2, RefreshCw, Truck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { formatMinor } from "@/services/serviceMarketplace";
import {
  advanceOrder,
  canUse,
  fetchOrderQueue,
  newRequestKey,
  NEXT_STEP,
  requestOrderDelivery,
  setPickupAddress,
  type ConsoleOrder,
  type ConsoleStatus,
} from "@/services/merchantAi";
import StoreSwitcher from "./StoreSwitcher";

const COLUMNS: Array<{ status: ConsoleStatus; title: string }> = [
  { status: "pending", title: "New" },
  { status: "accepted", title: "Accepted" },
  { status: "preparing", title: "Preparing" },
  { status: "ready", title: "Ready" },
];

const POLL_MS = 15_000;

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

interface MerchantOrderConsoleProps {
  /** Standalone tablet mode (/merchant/console) rather than a dashboard tab. */
  standalone?: boolean;
}

/**
 * The order queue a store works from, sized for a counter tablet. Orders move
 * one step at a time through the database (merchant_order_advance); nothing
 * changes here until the server confirms it, and nothing can be done offline.
 */
const MerchantOrderConsole: React.FC<MerchantOrderConsoleProps> = ({ standalone = false }) => {
  const { stores, current, setStoreId, isLoading: accessLoading } = useMerchantAccess();
  const queryClient = useQueryClient();
  const online = useOnline();
  const storeId = current?.store_id;
  const allowed = canUse(current, "orders", "order_console");

  const queue = useQuery({
    queryKey: ["merchant-order-queue", storeId],
    queryFn: () => fetchOrderQueue(storeId!),
    enabled: !!storeId && allowed,
    refetchInterval: online ? POLL_MS : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // One key per intended change, reused if the same tap is retried after a failure.
  const requestKeys = useRef(new Map<string, string>());
  const advance = useMutation({
    mutationFn: ({ order, to }: { order: ConsoleOrder; to: ConsoleStatus }) => {
      const id = `${order.order_id}:${to}`;
      if (!requestKeys.current.has(id)) requestKeys.current.set(id, newRequestKey());
      return advanceOrder(storeId!, order.order_id, to, requestKeys.current.get(id)!);
    },
    onSuccess: (_result, { order, to }) => {
      requestKeys.current.delete(`${order.order_id}:${to}`);
      queryClient.invalidateQueries({ queryKey: ["merchant-order-queue", storeId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not update the order. Check your connection and try again.");
      queryClient.invalidateQueries({ queryKey: ["merchant-order-queue", storeId] });
    },
  });

  const orders = useMemo(() => queue.data ?? [], [queue.data]);
  const waitingIds = useMemo(
    () => (queue.data ? orders.filter((o) => o.status === "pending").map((o) => o.order_id) : undefined),
    [queue.data, orders],
  );
  const { soundOn, toggleSound } = useNewOrderAlert(waitingIds, (count) =>
    toast.info(count === 1 ? "New order" : `${count} new orders`));

  if (accessLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!current || !allowed) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {stores.length === 0
            ? "Your account is not linked to a store."
            : "The order console is not switched on for this store, or your role does not include orders."}
        </CardContent>
      </Card>
    );
  }

  const busyId = advance.isPending ? advance.variables?.order.order_id : undefined;

  const requestDriver = async (order: ConsoleOrder) => {
    try {
      const job = await requestOrderDelivery(current.store_id, order.order_id);
      toast.success(job.repeated ? "A driver was already requested" : "Driver requested. One will be matched shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request a driver");
    } finally {
      queryClient.invalidateQueries({ queryKey: ["merchant-order-queue", storeId] });
    }
  };

  return (
    <div className={standalone ? "min-h-screen bg-background p-3 md:p-5" : ""}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {standalone && <h1 className="mr-2 text-xl font-semibold">{current.store_name}</h1>}
        <StoreSwitcher stores={stores} current={current} onChange={setStoreId} />
        <div className="ml-auto flex items-center gap-2">
          {!online ? (
            <Badge variant="destructive" className="gap-1 px-3 py-1 text-sm"><WifiOff className="h-4 w-4" /> Offline</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              {queue.dataUpdatedAt ? `Updated ${formatDistanceToNowStrict(queue.dataUpdatedAt)} ago` : ""}
            </span>
          )}
          <Button variant="outline" size="lg" onClick={() => queue.refetch()} disabled={queue.isFetching} aria-label="Refresh orders">
            <RefreshCw className={`h-5 w-5 ${queue.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="lg" onClick={toggleSound} aria-label={soundOn ? "Turn order sound off" : "Turn order sound on"}>
            {soundOn ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </Button>
          {!standalone && (
            <Button variant="outline" size="lg" asChild>
              <a href="/merchant/console" target="_blank" rel="noreferrer" aria-label="Open full-screen console">
                <Maximize2 className="h-5 w-5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          You are offline. Orders shown may be out of date, and changes are paused until the connection is back.
        </p>
      )}
      {!current.pickup_address && <PickupAddressCard storeId={current.store_id} canEdit={canUse(current, "settings")} />}
      {queue.error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          {(queue.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((o) => o.status === column.status);
          return (
            <section key={column.status} aria-label={column.title}>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                {column.title}
                <Badge variant={column.status === "pending" && columnOrders.length ? "default" : "secondary"}>
                  {columnOrders.length}
                </Badge>
              </h2>
              <div className="space-y-3">
                {queue.isLoading && <Card><CardContent className="h-28 animate-pulse" /></Card>}
                {columnOrders.map((order) => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    disabled={!online || advance.isPending}
                    busy={busyId === order.order_id}
                    onAdvance={(to) => advance.mutate({ order, to })}
                    canRequestDriver={online && !!current.pickup_address}
                    onRequestDriver={() => requestDriver(order)}
                  />
                ))}
                {!queue.isLoading && columnOrders.length === 0 && (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">None</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {orders.some((o) => o.status === "mixed") && (
        <p className="mt-4 text-sm text-muted-foreground">
          Some orders have items at different steps. Update those from the Orders page.
        </p>
      )}
    </div>
  );
};

const PickupAddressCard: React.FC<{ storeId: string; canEdit: boolean }> = ({ storeId, canEdit }) => {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState({ street: "", city: "", province: "Mpumalanga", phone: "" });
  const save = useMutation({
    mutationFn: () => setPickupAddress(storeId, address),
    onSuccess: () => {
      toast.success("Pickup address saved");
      queryClient.invalidateQueries({ queryKey: ["merchant-access"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!canEdit) {
    return (
      <p className="mb-4 rounded-md border p-3 text-sm text-muted-foreground">
        Drivers can't be requested until the store owner adds a pickup address.
      </p>
    );
  }
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Where should drivers collect orders?</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input required placeholder="Street address" value={address.street} className="h-11 md:col-span-2"
            onChange={(e) => setAddress({ ...address, street: e.target.value })} aria-label="Street address" />
          <Input required placeholder="Town" value={address.city} className="h-11"
            onChange={(e) => setAddress({ ...address, city: e.target.value })} aria-label="Town" />
          <Input placeholder="Province" value={address.province} className="h-11"
            onChange={(e) => setAddress({ ...address, province: e.target.value })} aria-label="Province" />
          <Input placeholder="Phone for drivers" value={address.phone} className="h-11"
            onChange={(e) => setAddress({ ...address, phone: e.target.value })} aria-label="Phone for drivers" />
          <Button type="submit" className="h-11" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const DELIVERY_LABELS: Record<string, string> = {
  pending: "Finding a driver",
  accepted: "Driver on the way",
  picked_up: "Collected",
  in_transit: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Delivery cancelled",
};

const OrderCard: React.FC<{
  order: ConsoleOrder;
  disabled: boolean;
  busy: boolean;
  onAdvance: (to: ConsoleStatus) => void;
  canRequestDriver: boolean;
  onRequestDriver: () => Promise<void>;
}> = ({ order, disabled, busy, onAdvance, canRequestDriver, onRequestDriver }) => {
  const next = NEXT_STEP[order.status];
  const [requesting, setRequesting] = useState(false);
  const driverPossible = order.status === "ready" && order.single_store && order.has_delivery_address;
  const ageMinutes = (Date.now() - new Date(order.created_at).getTime()) / 60_000;
  return (
    <Card className={order.status === "pending" && ageMinutes > 15 ? "border-amber-500" : undefined}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-baseline justify-between gap-2 text-base">
          <span>#{order.order_id.slice(0, 8).toUpperCase()}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {formatDistanceToNowStrict(new Date(order.created_at))} ago
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {[order.customer_first_name, order.customer_city, order.shipping_method].filter(Boolean).join(" · ")}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <ul className="space-y-1 text-[15px]">
          {order.items.map((item) => (
            <li key={item.item_id} className="flex justify-between gap-2">
              <span><strong>{item.quantity}×</strong> {item.name ?? "Item"}</span>
            </li>
          ))}
        </ul>
        {order.notes && <p className="rounded bg-muted p-2 text-sm">{order.notes}</p>}
        <div className="flex items-center justify-between">
          <span className="font-semibold">{formatMinor(order.store_total_minor)}</span>
        </div>
        {order.delivery_status && (
          <Badge variant="secondary" className="gap-1"><Truck className="h-3 w-3" /> {DELIVERY_LABELS[order.delivery_status] ?? order.delivery_status}</Badge>
        )}
        {driverPossible && !order.delivery_status && (
          <Button variant="outline" className="h-12 w-full gap-2" disabled={!canRequestDriver || requesting}
            onClick={async () => {
              setRequesting(true);
              await onRequestDriver();
              setRequesting(false);
            }}>
            {requesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />} Request driver
          </Button>
        )}
        {next && (
          <Button className="h-14 w-full text-lg" disabled={disabled} onClick={() => onAdvance(next.to)}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : next.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MerchantOrderConsole;
