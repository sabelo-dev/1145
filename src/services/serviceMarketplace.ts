import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { paymentReturnUrl, submitPayFastForm } from "@/lib/payments";
import type {
  BriefField, ProviderRating, ServiceAuditEntry, ServiceCategory, ServiceListing, ServiceMode, ServiceOrder,
  ServiceOrderEvent, ServiceOrderFile, ServiceOrderMessage, ServicePackage, ServicePayment, ServiceProvider,
  ServiceReview, PortfolioItem,
} from "@/types/services";
import { SERVICE_FILE_MAX_BYTES } from "@/types/services";

// The marketplace tables are newer than the generated database types.
const db = supabase as unknown as SupabaseClient;
const BUCKET = "service-order-files";

const rpc = async <T = void>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
};
const many = async <T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
};

/** Cents → "R 1 499,00". Display only; arithmetic stays in integer cents. */
export const formatMinor = (minor: number, currency = "ZAR") =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(minor / 100);

/** "12.50" → 1250, or null when it isn't a valid amount. Avoids floating-point maths on money. */
export const parseMinor = (input: string): number | null => {
  const match = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
};

export const makeSlug = (text: string) => {
  const base = text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "service";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
};

// ── Catalog (public) ───────────────────────────────────────────
const LISTING_SELECT =
  "*, provider:service_provider_profiles(id, user_id, display_name, bio, location, service_mode, portfolio, onboarding_status, approved_at), packages:service_packages(*), category:service_categories(id, name, slug)";

export const fetchServiceCategories = () =>
  many<ServiceCategory>(db.from("service_categories").select("*").eq("is_active", true).order("sort_order").order("name"));

export const fetchPublishedListings = async () => {
  const listings = await many<ServiceListing>(
    db.from("service_listings").select(LISTING_SELECT).eq("status", "published").order("published_at", { ascending: false }).limit(200));
  // Only listings someone can actually buy.
  return listings
    .map((l) => ({ ...l, packages: (l.packages ?? []).filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor) }))
    .filter((l) => l.packages.length > 0 && l.provider);
};

export const fetchListingBySlug = async (slug: string) => {
  const { data, error } = await db.from("service_listings").select(LISTING_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const listing = data as ServiceListing;
  listing.packages = (listing.packages ?? []).filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor);
  return listing;
};

/** Providers with enough published reviews for a rating to mean something. */
export const fetchProviderRatings = async () => {
  const rows = await many<ProviderRating>(db.from("service_provider_ratings").select("*"));
  return new Map(rows.map((r) => [r.provider_id, { ...r, average_rating: Number(r.average_rating) }]));
};

export const fetchProviderReviews = (providerId: string) =>
  many<ServiceReview>(db.from("service_reviews").select("*").eq("provider_id", providerId).eq("moderation_status", "published")
    .order("created_at", { ascending: false }).limit(20));

// ── Ordering (customer) ────────────────────────────────────────
/** Creates the order from the server's copy of the package. The key makes retries safe. */
export const createServiceOrder = (packageId: string, idempotencyKey: string) =>
  rpc<string>("service_create_order", { p_package_id: packageId, p_idempotency_key: idempotencyKey });

export async function payForServiceOrder(orderId: string, customer: { email?: string; name?: string }) {
  const [firstName, ...rest] = (customer.name ?? "").trim().split(/\s+/);
  const { data, error } = await supabase.functions.invoke("payfast-payment", {
    body: {
      customStr1: orderId,
      customStr2: "service_order",
      returnUrl: paymentReturnUrl(`/hire/orders/${orderId}?paid=1`),
      cancelUrl: paymentReturnUrl(`/hire/orders/${orderId}`),
      customerEmail: customer.email,
      customerFirstName: firstName || undefined,
      customerLastName: rest.join(" ") || undefined,
    },
  });
  if (error) throw new Error(error.message || "Could not start the payment");
  if (!data?.success) throw new Error(data?.error || "Could not start the payment");
  await submitPayFastForm(data.action, data.formData);
}

const ORDER_SELECT = "*, provider:service_provider_profiles(id, display_name, user_id)";

export const fetchServiceOrder = async (orderId: string) => {
  const { data, error } = await db.from("service_orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ServiceOrder | null;
};

export const fetchMyServiceOrders = (userId: string) =>
  many<ServiceOrder>(db.from("service_orders").select(ORDER_SELECT).eq("customer_user_id", userId).order("created_at", { ascending: false }).limit(100));

export const submitServiceBrief = (orderId: string, brief: Record<string, string>) =>
  rpc("service_submit_brief", { p_order_id: orderId, p_brief: brief });

export const customerOrderAction = (orderId: string, action: "accept" | "request_revision" | "cancel" | "dispute", reason?: string) =>
  rpc("service_customer_action", { p_order_id: orderId, p_action: action, p_reason: reason ?? null });

export const providerOrderAction = (orderId: string, action: "start" | "wait" | "resume" | "deliver" | "dispute", note?: string) =>
  rpc("service_provider_action", { p_order_id: orderId, p_action: action, p_note: note ?? null });

// ── Order workspace ────────────────────────────────────────────
export const fetchOrderEvents = (orderId: string) =>
  many<ServiceOrderEvent>(db.from("service_order_events").select("*").eq("order_id", orderId).order("created_at"));

export const fetchOrderMessages = (orderId: string) =>
  many<ServiceOrderMessage>(db.from("service_order_messages").select("*").eq("order_id", orderId).order("created_at"));

export const fetchOrderFiles = (orderId: string) =>
  many<ServiceOrderFile>(db.from("service_order_files").select("*").eq("order_id", orderId).order("created_at"));

export const postOrderMessage = (orderId: string, message: string) =>
  rpc<string>("service_post_message", { p_order_id: orderId, p_message: message });

// Browsers leave the type blank for some files (CSV on Windows, for one), so fall back to the extension.
const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", mp4: "video/mp4", mp3: "audio/mpeg",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Uploads to private storage under <order>/<me>/… and records the file on the order. */
export async function uploadOrderFile(orderId: string, userId: string, file: File, visibility: ServiceOrderFile["visibility"]) {
  if (file.size > SERVICE_FILE_MAX_BYTES) throw new Error(`${file.name} is larger than 25 MB`);
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  // The stored name is random; the original name is kept only on the order record.
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new Error(`${file.name}: that file type isn't allowed`);
  const key = `${orderId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: false, contentType: mimeType });
  if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);
  try {
    await rpc("service_register_file", {
      p_order_id: orderId, p_storage_key: key, p_filename: file.name, p_mime_type: mimeType,
      p_size_bytes: file.size, p_visibility: visibility,
    });
  } catch (registerError) {
    await supabase.storage.from(BUCKET).remove([key]).catch(() => undefined);
    throw registerError;
  }
}

/** A link that works for five minutes, issued only if the caller may read the file. */
export async function getOrderFileUrl(file: ServiceOrderFile) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_key, 300, { download: file.original_filename });
  if (error || !data?.signedUrl) throw new Error("This file isn't available to you");
  return data.signedUrl;
}

/** Calls back when the order or its conversation changes. Returns an unsubscribe function. */
export function watchServiceOrder(orderId: string, onChange: () => void) {
  const channel = supabase
    .channel(`service-order-${orderId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "service_orders", filter: `id=eq.${orderId}` }, onChange)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_order_messages", filter: `order_id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export const fetchOrderReview = async (orderId: string) => {
  const { data, error } = await db.from("service_reviews").select("*").eq("order_id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ServiceReview | null;
};
export const submitServiceReview = (orderId: string, rating: number, text: string) =>
  rpc("service_submit_review", { p_order_id: orderId, p_rating: rating, p_text: text || null });
export const respondToReview = (reviewId: string, response: string) =>
  rpc("service_respond_to_review", { p_review_id: reviewId, p_response: response });

// ── Provider ───────────────────────────────────────────────────
export const fetchMyProviderProfile = async (userId: string) => {
  const { data, error } = await db.from("service_provider_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ServiceProvider | null;
};

export interface ProviderProfileInput {
  display_name: string; bio: string | null; location: string | null; service_mode: ServiceMode;
  portfolio: PortfolioItem[]; portfolio_rights_confirmed: boolean;
}
export interface ProviderPrivateInput { contact_email: string | null; contact_phone: string | null }

export async function saveProviderProfile(userId: string, existingId: string | null, profile: ProviderProfileInput, contact: ProviderPrivateInput) {
  let providerId = existingId;
  if (providerId) {
    const { error } = await db.from("service_provider_profiles").update(profile).eq("id", providerId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.from("service_provider_profiles").insert({ ...profile, user_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    providerId = (data as { id: string }).id;
  }
  const { error } = await db.from("service_provider_private").upsert({ provider_id: providerId, ...contact, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return providerId;
}

export const fetchProviderPrivate = async (providerId: string) => {
  const { data, error } = await db.from("service_provider_private").select("contact_email, contact_phone").eq("provider_id", providerId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { contact_email: null, contact_phone: null }) as ProviderPrivateInput;
};

export const submitProviderProfile = () => rpc("service_submit_provider_profile");

export const fetchProviderListings = (providerId: string) =>
  many<ServiceListing>(db.from("service_listings").select("*, packages:service_packages(*), category:service_categories(id, name, slug)")
    .eq("provider_id", providerId).order("created_at", { ascending: false }));

export interface ListingInput {
  title: string; summary: string | null; description: string | null; exclusions: string | null;
  category_id: string | null; required_brief_schema: BriefField[]; image_url: string | null;
}
export type PackageInput = Pick<ServicePackage, "name" | "description" | "price_minor" | "delivery_days" | "revisions_included" | "deliverables"> & { id?: string };

/** Saves a listing and replaces its package set (kept ids are updated, missing ones removed). */
export async function saveListing(providerId: string, listingId: string | null, listing: ListingInput, packages: PackageInput[]) {
  let id = listingId;
  if (id) {
    const { error } = await db.from("service_listings").update(listing).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.from("service_listings").insert({ ...listing, provider_id: providerId, slug: makeSlug(listing.title) }).select("id").single();
    if (error) throw new Error(error.message);
    id = (data as { id: string }).id;
  }
  const existing = await many<{ id: string }>(db.from("service_packages").select("id").eq("listing_id", id));
  const keep = new Set(packages.map((p) => p.id).filter(Boolean));
  const remove = existing.filter((p) => !keep.has(p.id)).map((p) => p.id);
  if (remove.length) {
    const { error } = await db.from("service_packages").delete().in("id", remove);
    if (error) throw new Error(error.message);
  }
  for (const [index, pkg] of packages.entries()) {
    const fields = {
      listing_id: id, name: pkg.name, description: pkg.description, price_minor: pkg.price_minor,
      delivery_days: pkg.delivery_days, revisions_included: pkg.revisions_included, deliverables: pkg.deliverables, sort_order: index,
    };
    const { error } = pkg.id ? await db.from("service_packages").update(fields).eq("id", pkg.id) : await db.from("service_packages").insert(fields);
    if (error) throw new Error(error.message);
  }
  return id;
}

export const listingAction = (listingId: string, action: "submit" | "pause" | "resume" | "archive") =>
  rpc("service_listing_action", { p_listing_id: listingId, p_action: action });
export const deleteDraftListing = async (listingId: string) => {
  const { error } = await db.from("service_listings").delete().eq("id", listingId);
  if (error) throw new Error(error.message);
};

export const fetchProviderOrders = (providerId: string) =>
  many<ServiceOrder>(db.from("service_orders").select(ORDER_SELECT).eq("provider_id", providerId).neq("state", "pending_payment")
    .order("created_at", { ascending: false }).limit(200));

/** Payment records the caller may see: a provider's own earnings, or everything for an admin. */
export const fetchServicePayments = () =>
  many<ServicePayment>(db.from("service_payments").select("*").order("paid_at", { ascending: false }).limit(500));

// ── Admin ──────────────────────────────────────────────────────
export const adminFetchProviders = () =>
  many<ServiceProvider>(db.from("service_provider_profiles").select("*").neq("onboarding_status", "draft").order("created_at", { ascending: false }));
export const adminFetchListings = () =>
  many<ServiceListing>(db.from("service_listings").select(LISTING_SELECT).not("status", "in", "(draft,archived)").order("created_at", { ascending: false }).limit(300));
export const adminFetchOrders = () =>
  many<ServiceOrder>(db.from("service_orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(300));
export const adminFetchReviews = () =>
  many<ServiceReview>(db.from("service_reviews").select("*").order("created_at", { ascending: false }).limit(200));
export const adminFetchAudit = () =>
  many<ServiceAuditEntry>(db.from("service_admin_audit").select("*").order("created_at", { ascending: false }).limit(200));
export const adminFetchAllCategories = () =>
  many<ServiceCategory>(db.from("service_categories").select("*").order("sort_order").order("name"));
export const fetchMarketplaceFeeBps = async () => {
  const { data, error } = await db.from("service_marketplace_settings").select("fee_bps").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { fee_bps: number } | null)?.fee_bps ?? 0;
};

export const adminReviewProvider = (providerId: string, status: string, reason?: string) =>
  rpc("service_admin_review_provider", { p_provider_id: providerId, p_status: status, p_reason: reason ?? null });
export const adminReviewListing = (listingId: string, status: string, reason?: string) =>
  rpc("service_admin_review_listing", { p_listing_id: listingId, p_status: status, p_reason: reason ?? null });
export const adminOpenOrder = (orderId: string, reason: string) =>
  rpc("service_admin_open_order", { p_order_id: orderId, p_reason: reason });
export const adminResolveDispute = (orderId: string, outcome: "resume" | "complete" | "cancel", reason: string) =>
  rpc("service_admin_resolve_dispute", { p_order_id: orderId, p_outcome: outcome, p_reason: reason });
export const adminRecordRefund = (orderId: string, amountMinor: number, reference: string, reason: string) =>
  rpc("service_admin_record_refund", { p_order_id: orderId, p_amount_minor: amountMinor, p_reference: reference, p_reason: reason });
export const adminRecordPayout = (orderId: string, reference: string) =>
  rpc("service_admin_record_payout", { p_order_id: orderId, p_reference: reference, p_reason: null });
export const adminSetFee = (feeBps: number, reason: string) =>
  rpc("service_admin_set_fee", { p_fee_bps: feeBps, p_reason: reason });
export const adminModerateReview = (reviewId: string, status: "published" | "removed", reason: string) =>
  rpc("service_admin_moderate_review", { p_review_id: reviewId, p_status: status, p_reason: reason });
export async function adminSaveCategory(category: { id?: string; name: string; sort_order: number; is_active: boolean }) {
  const { error } = category.id
    ? await db.from("service_categories").update({ name: category.name, sort_order: category.sort_order, is_active: category.is_active }).eq("id", category.id)
    : await db.from("service_categories").insert({ name: category.name, slug: makeSlug(category.name), sort_order: category.sort_order, is_active: category.is_active });
  if (error) throw new Error(error.message);
}
