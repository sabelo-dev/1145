import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DropshipSupplier {
  id: string;
  code: string;
  name: string;
  adapter: string;
  status: string;
  health: string;
  country: string | null;
  base_currency: string;
  safety_stock: number;
  pricing_rule: any;
  shipping_rule: any;
  sync_intervals: any;
  auto_price_update: boolean;
  last_inventory_sync_at: string | null;
  last_orders_sync_at: string | null;
  last_health_check_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
}

export interface DropshipProduct {
  id: string;
  supplier_id: string;
  supplier_product_id: string;
  name: string;
  description: string | null;
  images: any;
  category: string | null;
  supplier_cost: number;
  supplier_currency: string;
  supplier_shipping_cost: number;
  stock: number;
  landed_cost_zar: number;
  recommended_price_zar: number;
  status: string;
  sync_status: string;
  sync_error: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface DiscoveredProduct {
  supplierProductId: string;
  name: string;
  images: string[];
  category?: string;
  cost: number;
  currency: string;
  stock: number;
  pricing: {
    landedCostZar: number;
    recommendedPriceZar: number;
    merchantProfitZar: number;
    platformCostsZar: number;
  };
}

async function callAdmin<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("dropship-admin", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

async function callMerchant<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("dropship-merchant", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/* ------------------------------------------------------------------ ADMIN */

export function useDropshipAdmin() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<DropshipSupplier[]>([]);
  const [products, setProducts] = useState<DropshipProduct[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadSuppliers = useCallback(async () => {
    const { data } = await supabase.from("dropship_suppliers").select("*").order("name");
    setSuppliers((data as any) || []);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase
      .from("dropship_products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setProducts((data as any) || []);
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await callAdmin("analytics"));
    } catch {
      setAnalytics(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSuppliers(), loadProducts(), loadAnalytics()]);
    setLoading(false);
  }, [loadSuppliers, loadProducts, loadAnalytics]);

  useEffect(() => { refresh(); }, [refresh]);

  const wrap = async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast({ title: success });
      return result;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Something went wrong", description: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    suppliers, products, analytics, loading, busy, refresh, loadProducts, loadSuppliers, loadAnalytics,
    testSupplier: (supplier_id: string) =>
      wrap(async () => {
        const res = await callAdmin("supplier.test", { supplier_id });
        await loadSuppliers();
        return res;
      }, "Connection checked"),
    updateSupplier: (supplier_id: string, patch: Record<string, unknown>) =>
      wrap(async () => {
        await callAdmin("supplier.update", { supplier_id, patch });
        await loadSuppliers();
      }, "Supplier updated"),
    discover: (supplier_id: string, params: Record<string, unknown>) =>
      wrap(() => callAdmin<{ items: DiscoveredProduct[]; total: number }>("discover", { supplier_id, ...params })),
    importProducts: (supplier_id: string, supplier_product_ids: string[]) =>
      wrap(async () => {
        const res = await callAdmin("import", { supplier_id, supplier_product_ids });
        await loadProducts();
        return res;
      }, "Products imported for review"),
    decide: (product_ids: string[], decision: string, reason?: string) =>
      wrap(async () => {
        await callAdmin("product.decide", { product_ids, decision, reason });
        await loadProducts();
      }, "Catalogue updated"),
    publishToMarketplace: (product_ids: string[]) =>
      wrap(async () => {
        const res = await callAdmin("marketplace.publish", { product_ids });
        await loadProducts();
        return res;
      }, "Live on the marketplace"),
    unpublishFromMarketplace: (product_ids: string[]) =>
      wrap(async () => {
        const res = await callAdmin("marketplace.unpublish", { product_ids });
        await loadProducts();
        return res;
      }, "Removed from the marketplace"),

    reprice: (supplier_id: string) =>
      wrap(async () => {
        const res = await callAdmin("product.reprice", { supplier_id });
        await loadProducts();
        return res;
      }, "Prices recalculated"),
    previewPrice: (supplier_id: string, cost: number, shipping: number, pricing_rule?: any) =>
      callAdmin("pricing.preview", { supplier_id, cost, shipping, pricing_rule }),
    runSync: (job_type: string, supplier_id?: string) =>
      wrap(async () => {
        const res = await callAdmin("sync.run", { job_type, supplier_id });
        await refresh();
        return res;
      }, "Synchronisation finished"),
    retryFulfillment: (fulfillment_id: string) =>
      wrap(() => callAdmin("fulfillment.retry", { fulfillment_id }), "Retry submitted"),
    fulfillmentQueue: () => callAdmin<{ orders: any[] }>("fulfillment.queue"),
    submitFulfillment: (order_id: string) =>
      wrap(() => callAdmin("fulfillment.submit", { order_id }), "Order sent to the supplier"),
    trackFulfillment: (fulfillment_id: string) =>
      wrap(() => callAdmin("fulfillment.track", { fulfillment_id }), "Shipment status refreshed"),
    dispatchDelivery: (fulfillment_id: string) =>
      wrap(() => callAdmin("delivery.dispatch", { fulfillment_id }), "Driver job created"),
    decideReturn: (return_id: string, decision: string, resolution?: string, refund_amount?: number) =>
      wrap(() => callAdmin("return.decide", { return_id, decision, resolution, refund_amount }), "Return updated"),
    processRefund: (order_id: string, amount: number, return_id?: string) =>
      wrap(() => callAdmin("refund.process", { order_id, amount, return_id }), "Refund processed"),
  };
}

/* --------------------------------------------------------------- MERCHANT */

export function useDropshipMerchant() {
  const { toast } = useToast();
  const [catalogue, setCatalogue] = useState<DropshipProduct[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [fx, setFx] = useState<{ rate: number; updated_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cat, lst, ful] = await Promise.all([
      supabase.from("dropship_products").select("*").in("status", ["approved", "published"]).order("created_at", { ascending: false }).limit(300),
      supabase.from("dropship_listings").select("*, dropship_products(*)").order("created_at", { ascending: false }),
      supabase.from("dropship_fulfillments").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setCatalogue((cat.data as any) || []);
    setListings((lst.data as any) || []);
    setFulfillments((ful.data as any) || []);
    try { setSummary(await callMerchant("summary")); } catch { setSummary(null); }
    try { setStore(((await callMerchant<any>("store.info")) || {}).store ?? null); } catch { setStore(null); }
    try {
      const r = await callMerchant<{ rate: number; updated_at: string | null }>("fx.rate", { from: "USD" });
      setFx(r ? { rate: r.rate, updated_at: r.updated_at } : null);
    } catch { setFx(null); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const wrap = async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
    setBusy(true);
    try {
      const res = await fn();
      if (success) toast({ title: success });
      await load();
      return res;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Something went wrong", description: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    catalogue, listings, fulfillments, summary, store, fx, loading, busy, reload: load,
    addToStore: (dropship_product_id: string, selling_price?: number) =>
      wrap(() => callMerchant("listing.create", { dropship_product_id, selling_price }), "Added to your store"),
    addAndPublish: (dropship_product_id: string, selling_price?: number) =>
      wrap(async () => {
        const created = await callMerchant<{ listing: { id: string } }>("listing.create", {
          dropship_product_id, selling_price,
        });
        if (created?.listing?.id) await callMerchant("listing.publish", { listing_id: created.listing.id });
        return created;
      }, "Product published to your store"),
    updateListing: (listing_id: string, patch: Record<string, unknown>) =>
      wrap(() => callMerchant("listing.update", { listing_id, ...patch }), "Listing updated"),
    publish: (listing_id: string) => wrap(() => callMerchant("listing.publish", { listing_id }), "Product published"),
    unpublish: (listing_id: string) => wrap(() => callMerchant("listing.unpublish", { listing_id }), "Product unpublished"),
    remove: (listing_id: string) => wrap(() => callMerchant("listing.delete", { listing_id }), "Product removed"),
  };
}

/* --------------------------------------------------------------- CUSTOMER */

export function useOrderFulfillment(orderId?: string) {
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!orderId);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    (async () => {
      const { data: f } = await supabase
        .from("dropship_fulfillments")
        .select("id, status, carrier, tracking_number, tracking_url, estimated_delivery, shipped_at, delivered_at")
        .eq("order_id", orderId);
      if (!active) return;
      setFulfillments(f || []);
      if (f?.length) {
        const { data: e } = await supabase
          .from("dropship_tracking_events")
          .select("*")
          .in("fulfillment_id", f.map((x) => x.id))
          .order("occurred_at", { ascending: false });
        if (active) setEvents(e || []);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [orderId]);

  return { fulfillments, events, loading };
}
