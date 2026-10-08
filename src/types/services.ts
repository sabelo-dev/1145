// Service marketplace ("Hire a pro").
// Mirrors supabase/migrations/20261008120000_service_marketplace.sql.
// All money is integer minor units (cents) in `currency`.

export type ProviderStatus = "draft" | "submitted" | "under_review" | "approved" | "changes_requested" | "rejected" | "suspended";
export type ServiceMode = "remote" | "in_person" | "both";

export interface PortfolioItem { title: string; url: string }

export interface ServiceProvider {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  location: string | null;
  service_mode: ServiceMode;
  portfolio: PortfolioItem[];
  portfolio_rights_confirmed: boolean;
  onboarding_status: ProviderStatus;
  review_note: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ProviderRating { provider_id: string; review_count: number; average_rating: number }

export interface ServiceCategory { id: string; parent_id: string | null; name: string; slug: string; sort_order: number; is_active: boolean }

export type ListingStatus = "draft" | "submitted" | "changes_requested" | "published" | "paused" | "rejected" | "archived";

export interface BriefField { key: string; label: string; type: "text" | "textarea"; required: boolean }

export interface ServicePackage {
  id: string;
  listing_id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  delivery_days: number;
  revisions_included: number;
  deliverables: string;
  sort_order: number;
  is_active: boolean;
}

export interface ServiceListing {
  id: string;
  provider_id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  exclusions: string | null;
  category_id: string | null;
  status: ListingStatus;
  review_note: string | null;
  currency: string;
  required_brief_schema: BriefField[];
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  provider?: ServiceProvider | null;
  packages?: ServicePackage[];
  category?: Pick<ServiceCategory, "id" | "name" | "slug"> | null;
}

export type ServiceOrderState =
  | "pending_payment" | "awaiting_brief" | "new" | "in_progress" | "waiting_for_customer" | "delivered"
  | "revision_requested" | "completed" | "cancelled" | "disputed" | "refunded" | "partially_refunded";

export interface ServiceOrder {
  id: string;
  order_number: string;
  customer_user_id: string;
  provider_id: string;
  listing_id: string | null;
  state: ServiceOrderState;
  listing_title: string;
  package_name: string;
  package_description: string | null;
  deliverables: string;
  exclusions: string | null;
  delivery_days: number;
  revisions_included: number;
  revisions_used: number;
  brief_schema: BriefField[];
  brief_json: Record<string, string> | null;
  currency: string;
  gross_amount_minor: number;
  marketplace_fee_minor: number;
  provider_net_minor: number;
  paid_at: string | null;
  due_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  created_at: string;
  provider?: Pick<ServiceProvider, "id" | "display_name" | "user_id"> | null;
}

export interface ServiceOrderEvent {
  id: string;
  order_id: string;
  actor_user_id: string | null;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  reason: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ServiceOrderMessage {
  id: string;
  order_id: string;
  sender_user_id: string;
  sender_role: "customer" | "provider" | "support";
  kind: "message" | "delivery" | "revision";
  message: string;
  created_at: string;
}

export interface ServiceOrderFile {
  id: string;
  order_id: string;
  uploader_user_id: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  visibility: "brief" | "message" | "delivery";
  created_at: string;
}

export interface ServicePayment {
  id: string;
  order_id: string;
  provider_payment_ref: string | null;
  status: "paid" | "refund_due" | "partially_refunded" | "refunded";
  gross_amount_minor: number;
  marketplace_fee_minor: number;
  provider_net_minor: number;
  refunded_amount_minor: number;
  refund_ref: string | null;
  payout_ref: string | null;
  payout_status: "not_due" | "pending" | "paid" | "cancelled";
  paid_at: string;
}

export interface ServiceReview {
  id: string;
  order_id: string;
  listing_id: string | null;
  provider_id: string;
  rating: number;
  review_text: string | null;
  provider_response: string | null;
  moderation_status: "published" | "removed";
  created_at: string;
}

export interface ServiceAuditEntry {
  id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  reason: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

/** Plain-language state names, shared by customers, providers and admins. */
export const ORDER_STATE_LABEL: Record<ServiceOrderState, string> = {
  pending_payment: "Awaiting payment",
  awaiting_brief: "Paid — brief needed",
  new: "New — waiting for provider",
  in_progress: "In progress",
  waiting_for_customer: "Waiting for customer",
  delivered: "Delivered — awaiting review",
  revision_requested: "Revision requested",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Issue under review",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft", submitted: "In review", changes_requested: "Changes requested", published: "Published",
  paused: "Paused", rejected: "Rejected", archived: "Archived",
};

export const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under review", approved: "Approved",
  changes_requested: "Changes requested", rejected: "Rejected", suspended: "Suspended",
};

/** How event types read in an order's history. */
export const EVENT_LABEL: Record<string, string> = {
  order_created: "Order created",
  payment_confirmed: "Payment confirmed",
  payment_after_cancellation: "Payment received after cancellation — refund due",
  brief_submitted: "Brief submitted",
  brief_updated: "Brief updated",
  order_acknowledged: "Provider started work",
  revision_started: "Provider started the revision",
  waiting_for_customer: "Provider asked the customer for something",
  customer_replied: "Customer replied — work continues",
  work_resumed: "Work resumed",
  delivery_submitted: "Delivery submitted",
  revision_requested: "Revision requested",
  delivery_accepted: "Delivery accepted",
  cancelled_before_payment: "Cancelled before payment",
  dispute_opened: "Issue raised",
  dispute_resolved: "Issue resolved by 1145",
  refund_recorded: "Refund recorded",
  payout_recorded: "Payout recorded",
  review_submitted: "Review left",
};

/** Upload rules shown to users; the server enforces the same list. */
export const SERVICE_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mp3";
export const SERVICE_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const SERVICE_FILE_HELP = "Images, PDF, Office documents, text, CSV, ZIP, MP4 or MP3. Up to 25 MB each.";
