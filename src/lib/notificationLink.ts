/** Where a notification should take the user when they click it. */

// Notification type → the page that shows what the notification is about.
const TYPE_ROUTES: Record<string, string> = {
  // UCoin rewards
  ucoin_credit: "/ucoin-wallet",
  // Wallet, cards and bank
  deposit_completed: "/wallet",
  withdrawal_requested: "/wallet",
  withdrawal_completed: "/wallet",
  withdrawal_rejected: "/wallet",
  wallet_frozen: "/wallet",
  wallet_unfrozen: "/wallet",
  card_linked: "/wallet",
  card_removed: "/wallet",
  bank_linked: "/wallet",
  // Merchant account
  bank_verified: "/merchant/dashboard",
  subscription_activated: "/merchant/dashboard",
  subscription_changed: "/merchant/dashboard",
  subscription_cancelled: "/merchant/dashboard",
  // Creator account
  social_connection: "/influencer/social",
  // Rides and safety
  sos_confirmation: "/rides",
  emergency_active: "/rides",
  zone_warning: "/driver/dashboard",
  // Shopping
  order: "/dashboard?tab=orders",
  order_update: "/dashboard?tab=orders",
  order_placed: "/dashboard?tab=orders",
  auction: "/auctions",
};

/** Only same-site paths are followed (never //host or absolute URLs). */
const isSafePath = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

export function notificationLink(notification: { type: string; data?: Record<string, unknown> | null }): string {
  const data = notification.data ?? {};
  // A notification that names its own page (e.g. a service order) wins.
  if (isSafePath(data.link)) return data.link;
  if (TYPE_ROUTES[notification.type]) return TYPE_ROUTES[notification.type];
  if (notification.type.startsWith("ucoin")) return "/ucoin-wallet";
  if (data.order_id) return "/dashboard?tab=orders";
  if (data.auction_id) return "/auctions";
  // Anything else: the list of notifications, where it can be read in full.
  return "/dashboard?tab=notifications";
}
