import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { paymentReturnUrl, submitPayFastForm } from "@/lib/payments";
import type { Eatery, FoodAddress, FoodOrder, FoodOrderStatus, MenuItem, MenuSection } from "@/types/food";

// The food tables are newer than the generated database types.
const db = supabase as unknown as SupabaseClient;

const ORDER_SELECT =
  "*, eatery:eateries(id, name, slug, phone, prep_time_min, logo_url), items:food_order_items(id, name, unit_price, quantity)";

const money = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (row[key] != null) row[key] = Number(row[key]);
  return row;
};
const asEatery = (row: Record<string, unknown>) => money(row, ["delivery_fee", "min_order"]) as unknown as Eatery;
const asItem = (row: Record<string, unknown>) => money(row, ["price"]) as unknown as MenuItem;
const asOrder = (row: Record<string, unknown>) => {
  money(row, ["subtotal", "delivery_fee", "total"]);
  const items = (row.items as Record<string, unknown>[] | undefined) ?? [];
  items.forEach((item) => money(item, ["unit_price"]));
  return row as unknown as FoodOrder;
};

/** "Mama's Kitchen" → "mamas-kitchen-4f2a" (the suffix keeps slugs unique). */
export const makeEaterySlug = (name: string) => {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "eatery";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
};

// ── Customers ──────────────────────────────────────────────────

/** Approved eateries, open ones first. */
export async function fetchEateries(): Promise<Eatery[]> {
  const { data, error } = await db
    .from("eateries")
    .select("*")
    .eq("status", "approved")
    .order("accepting_orders", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []).map(asEatery);
}

export async function fetchEateryBySlug(slug: string): Promise<Eatery | null> {
  const { data, error } = await db.from("eateries").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? asEatery(data) : null;
}

export async function fetchMenu(eateryId: string): Promise<{ sections: MenuSection[]; items: MenuItem[] }> {
  const [sections, items] = await Promise.all([
    db.from("eatery_menu_sections").select("*").eq("eatery_id", eateryId).order("sort_order").order("created_at"),
    db.from("eatery_menu_items").select("*").eq("eatery_id", eateryId).order("sort_order").order("created_at"),
  ]);
  if (sections.error) throw sections.error;
  if (items.error) throw items.error;
  return { sections: (sections.data ?? []) as MenuSection[], items: (items.data ?? []).map(asItem) };
}

/** Creates the order (priced on the server) and returns its id. */
export async function placeFoodOrder(input: {
  eateryId: string;
  items: { menuItemId: string; quantity: number }[];
  address: FoodAddress;
  notes?: string;
}): Promise<string> {
  const { data, error } = await db.rpc("place_food_order", {
    p_eatery_id: input.eateryId,
    p_items: input.items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
    p_address: input.address,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Sends the customer to PayFast for an order that is awaiting payment. */
export async function payForFoodOrder(orderId: string, customer: { email?: string; firstName?: string; lastName?: string }) {
  const { data, error } = await supabase.functions.invoke("payfast-payment", {
    body: {
      customStr1: orderId,
      customStr2: "food_order",
      returnUrl: paymentReturnUrl(`/food/orders/${orderId}?paid=1`),
      cancelUrl: paymentReturnUrl(`/food/orders/${orderId}`),
      customerEmail: customer.email,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
    },
  });
  if (error) throw new Error(error.message || "Could not start the payment");
  if (!data?.success) throw new Error(data?.error || "Could not start the payment");
  await submitPayFastForm(data.action, data.formData);
}

export async function fetchFoodOrder(orderId: string): Promise<FoodOrder | null> {
  const { data, error } = await db.from("food_orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data ? asOrder(data) : null;
}

export async function fetchMyFoodOrders(userId: string): Promise<FoodOrder[]> {
  const { data, error } = await db
    .from("food_orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(asOrder);
}

export async function cancelFoodOrder(orderId: string) {
  const { error } = await db.rpc("cancel_food_order", { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

/** Calls back whenever the given order changes. Returns an unsubscribe function. */
export function watchFoodOrder(orderId: string, onChange: () => void) {
  const channel = supabase
    .channel(`food-order-${orderId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "food_orders", filter: `id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ── Eatery owners ──────────────────────────────────────────────

export type EateryDetails = Pick<Eatery,
  "name" | "description" | "cuisines" | "logo_url" | "cover_url" | "phone" | "address" | "city" | "province"
  | "opening_hours" | "prep_time_min" | "delivery_fee" | "min_order">;

export async function fetchMyEateries(userId: string): Promise<Eatery[]> {
  const { data, error } = await db.from("eateries").select("*").eq("owner_id", userId).order("created_at");
  if (error) throw error;
  return (data ?? []).map(asEatery);
}

export async function registerEatery(userId: string, details: EateryDetails): Promise<Eatery> {
  const { data, error } = await db
    .from("eateries")
    .insert({ ...details, owner_id: userId, slug: makeEaterySlug(details.name) })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return asEatery(data);
}

export async function updateEatery(eateryId: string, changes: Partial<EateryDetails> & { accepting_orders?: boolean }) {
  const { error } = await db.from("eateries").update(changes).eq("id", eateryId);
  if (error) throw new Error(error.message);
}

export async function saveMenuSection(section: { id?: string; eatery_id: string; name: string; sort_order?: number }) {
  const { error } = section.id
    ? await db.from("eatery_menu_sections").update({ name: section.name }).eq("id", section.id)
    : await db.from("eatery_menu_sections").insert({ eatery_id: section.eatery_id, name: section.name, sort_order: section.sort_order ?? 0 });
  if (error) throw new Error(error.message);
}

export async function deleteMenuSection(sectionId: string) {
  const { error } = await db.from("eatery_menu_sections").delete().eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export type MenuItemInput = Pick<MenuItem, "eatery_id" | "section_id" | "name" | "description" | "price" | "image_url" | "is_available">;

export async function saveMenuItem(item: MenuItemInput & { id?: string }) {
  // Only the editable columns: callers may pass a whole menu row.
  const { id } = item;
  const fields: MenuItemInput = {
    eatery_id: item.eatery_id, section_id: item.section_id, name: item.name, description: item.description,
    price: item.price, image_url: item.image_url, is_available: item.is_available,
  };
  const { error } = id
    ? await db.from("eatery_menu_items").update(fields).eq("id", id)
    : await db.from("eatery_menu_items").insert(fields);
  if (error) throw new Error(error.message);
}

export async function deleteMenuItem(itemId: string) {
  const { error } = await db.from("eatery_menu_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

/** Paid orders for an eatery, newest first. */
export async function fetchEateryOrders(eateryId: string): Promise<FoodOrder[]> {
  const { data, error } = await db
    .from("food_orders")
    .select(ORDER_SELECT)
    .eq("eatery_id", eateryId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(asOrder);
}

export async function eaterySetOrderStatus(orderId: string, status: Extract<FoodOrderStatus, "preparing" | "ready" | "rejected">, reason?: string) {
  const { error } = await db.rpc("eatery_update_food_order", { p_order_id: orderId, p_status: status, p_reason: reason ?? null });
  if (error) throw new Error(error.message);
}

/** Calls back whenever any order for the eatery changes. Returns an unsubscribe function. */
export function watchEateryOrders(eateryId: string, onChange: () => void) {
  const channel = supabase
    .channel(`eatery-orders-${eateryId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "food_orders", filter: `eatery_id=eq.${eateryId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ── Admin ──────────────────────────────────────────────────────

export async function fetchAllEateries(): Promise<Eatery[]> {
  const { data, error } = await db.from("eateries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(asEatery);
}

export async function setEateryStatus(eateryId: string, status: Eatery["status"]) {
  const changes = status === "approved" ? { status } : { status, accepting_orders: false };
  const { error } = await db.from("eateries").update(changes).eq("id", eateryId);
  if (error) throw new Error(error.message);
}
