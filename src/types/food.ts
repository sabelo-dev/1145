// Food delivery: eateries, menus and food orders.
// Mirrors supabase/migrations/20261008100000_food_delivery.sql.

export type EateryStatus = "pending" | "approved" | "suspended";

export interface Eatery {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  cuisines: string[];
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  address: string;
  city: string;
  province: string | null;
  opening_hours: string | null;
  prep_time_min: number;
  delivery_fee: number;
  min_order: number;
  status: EateryStatus;
  accepting_orders: boolean;
  created_at: string;
}

export interface MenuSection {
  id: string;
  eatery_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  eatery_id: string;
  section_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

export type FoodOrderStatus =
  | "pending_payment" | "placed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "rejected" | "cancelled";

export interface FoodAddress {
  name: string;
  street: string;
  city: string;
  postal_code: string;
  phone: string;
}

export interface FoodOrderItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export interface FoodOrder {
  id: string;
  user_id: string;
  eatery_id: string;
  status: FoodOrderStatus;
  payment_status: "pending" | "paid" | "refund_due" | "refunded";
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address: FoodAddress;
  notes: string | null;
  reject_reason: string | null;
  placed_at: string | null;
  created_at: string;
  eatery?: Pick<Eatery, "id" | "name" | "slug" | "phone" | "prep_time_min" | "logo_url"> | null;
  items?: FoodOrderItem[];
}

/** Customer-facing wording for each order state. */
export const FOOD_STATUS_LABEL: Record<FoodOrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Sent to the eatery",
  preparing: "Being prepared",
  ready: "Ready for pickup by driver",
  out_for_delivery: "On its way",
  delivered: "Delivered",
  rejected: "Declined by the eatery",
  cancelled: "Cancelled",
};

/** The happy path, in order, for progress displays. */
export const FOOD_PROGRESS: FoodOrderStatus[] = ["placed", "preparing", "ready", "out_for_delivery", "delivered"];
