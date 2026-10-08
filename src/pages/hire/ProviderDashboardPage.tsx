import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ListingEditor from "@/components/hire/ListingEditor";
import ProviderProfileForm from "@/components/hire/ProviderProfileForm";
import { ServiceOrderRow } from "@/pages/hire/ServiceOrdersPage";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteDraftListing, fetchMyProviderProfile, fetchProviderListings, fetchProviderOrders, fetchProviderPrivate, fetchServiceCategories,
  fetchServicePayments, formatMinor, listingAction, saveListing, saveProviderProfile, submitProviderProfile,
  type ProviderPrivateInput, type ProviderProfileInput,
} from "@/services/serviceMarketplace";
import {
  LISTING_STATUS_LABEL, ORDER_STATE_LABEL, PROVIDER_STATUS_LABEL,
  type ServiceListing, type ServiceOrder, type ServiceOrderState,
} from "@/types/services";

const STATUS_NOTE: Record<string, string> = {
  draft: "Complete your profile, then submit it for review. You can draft listings in the meantime.",
  submitted: "Your application is with 1145 for review. You can keep drafting listings.",
  under_review: "1145 is reviewing your application.",
  changes_requested: "1145 asked for changes to your profile. Update it and submit again.",
  rejected: "Your application was not approved.",
  suspended: "Your provider account is suspended and your listings are hidden. Contact 1145 support.",
};

const ORDER_GROUPS: { title: string; states: ServiceOrderState[] }[] = [
  { title: "Needs you", states: ["new", "revision_requested"] },
  { title: "In progress", states: ["in_progress"] },
  { title: "Waiting for the customer", states: ["awaiting_brief", "waiting_for_customer"] },
  { title: "Delivered, awaiting review", states: ["delivered"] },
  { title: "Issues under review", states: ["disputed"] },
  { title: "Finished", states: ["completed", "cancelled", "refunded", "partially_refunded"] },
];

/** Where a provider manages their profile, listings, orders and earnings. */
const ProviderDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ServiceListing | "new" | null>(null);
  const [filter, setFilter] = useState<ServiceOrderState | "">("");

  const { data: profile, isLoading } = useQuery({ queryKey: ["provider-profile", user?.id], queryFn: () => fetchMyProviderProfile(user!.id), enabled: !!user, staleTime: 0 });
  const providerId = profile?.id;
  const { data: contact } = useQuery({ queryKey: ["provider-private", providerId], queryFn: () => fetchProviderPrivate(providerId!), enabled: !!providerId, staleTime: 0 });
  const { data: listings } = useQuery({ queryKey: ["provider-listings", providerId], queryFn: () => fetchProviderListings(providerId!), enabled: !!providerId, staleTime: 0 });
  const { data: orders } = useQuery({ queryKey: ["provider-orders", providerId], queryFn: () => fetchProviderOrders(providerId!), enabled: !!providerId, staleTime: 0 });
  const { data: payments } = useQuery({ queryKey: ["provider-payments", providerId], queryFn: fetchServicePayments, enabled: !!providerId, staleTime: 0 });
  const { data: categories } = useQuery({ queryKey: ["service-categories"], queryFn: fetchServiceCategories, staleTime: 300_000 });

  const refresh = (name: string) => queryClient.invalidateQueries({ queryKey: [name] });
  const act = async (action: () => Promise<unknown>, done: string, ...invalidate: string[]) => {
    try {
      await action();
      await Promise.all(invalidate.map(refresh));
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work. Please try again.");
      return false;
    }
  };

  if (isLoading || !user) return <div className="page-container py-10" aria-busy><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-72 w-full rounded-2xl" /></div>;

  const saveProfile = async (details: ProviderProfileInput, contactDetails: ProviderPrivateInput) => {
    await saveProviderProfile(user.id, profile?.id ?? null, details, contactDetails);
    await Promise.all([refresh("provider-profile"), refresh("provider-private")]);
  };

  // First visit: only the profile form.
  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Become a provider | 1145 Services" noindex />
        <div className="page-container max-w-3xl py-8 md:py-12">
          <p className="eyebrow text-text-secondary">1145 Services</p>
          <h1 className="type-headline mt-2">Sell your services on 1145.</h1>
          <p className="type-lead mt-3 text-text-secondary">Start with your profile. 1145 reviews every provider and every listing before it goes live.</p>
          <div className="mt-8"><ProviderProfileForm profile={null} contact={{ contact_email: null, contact_phone: null }} defaultEmail={user.email} onSave={saveProfile} /></div>
        </div>
      </div>
    );
  }

  const status = profile.onboarding_status;
  const approved = status === "approved";
  const canSubmitProfile = status === "draft" || status === "changes_requested";
  const owed = (payments ?? []).filter((p) => p.payout_status === "pending").reduce((sum, p) => sum + p.provider_net_minor - p.refunded_amount_minor, 0);
  const paidOut = (payments ?? []).filter((p) => p.payout_status === "paid").reduce((sum, p) => sum + p.provider_net_minor - p.refunded_amount_minor, 0);
  const inProgress = (payments ?? []).filter((p) => p.payout_status === "not_due" && p.status === "paid").reduce((sum, p) => sum + p.provider_net_minor, 0);
  const visibleOrders = (orders ?? []).filter((o) => !filter || o.state === filter);
  const needsYou = (orders ?? []).filter((o) => o.state === "new" || o.state === "revision_requested").length;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Provider dashboard | 1145 Services" noindex />
      <div className="page-container py-8 md:py-12">
        <p className="eyebrow text-text-secondary">Provider dashboard</p>
        <h1 className="type-headline mt-2">{profile.display_name}</h1>
        <p className="mt-3 inline-flex rounded-full bg-surface-selected px-3 py-1 text-sm font-semibold text-brand">{PROVIDER_STATUS_LABEL[status]}</p>

        {!approved && (
          <div role="status" className="mt-5 rounded-2xl bg-surface-muted p-4 text-sm text-foreground">
            <p>{STATUS_NOTE[status]}</p>
            {profile.review_note && <p className="mt-2"><span className="font-semibold">Note from 1145:</span> {profile.review_note}</p>}
            {canSubmitProfile && (
              <Button variant="cta" className="mt-3 rounded-full" onClick={() => act(submitProviderProfile, "Submitted for review", "provider-profile")}>Submit profile for review</Button>
            )}
          </div>
        )}

        <Tabs defaultValue={approved ? "orders" : "profile"} className="mt-8">
          <TabsList>
            <TabsTrigger value="orders">Orders{needsYou ? ` (${needsYou})` : ""}</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* Orders */}
          <TabsContent value="orders" className="mt-6">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <label htmlFor="order-filter" className="text-sm text-text-secondary">Show</label>
              <select id="order-filter" value={filter} onChange={(e) => setFilter(e.target.value as ServiceOrderState | "")}
                className="h-11 rounded-full border border-border bg-background px-4 text-sm text-foreground focus:border-foreground focus:outline-none">
                <option value="">All orders</option>
                {Object.entries(ORDER_STATE_LABEL).filter(([state]) => state !== "pending_payment").map(([state, label]) => <option key={state} value={state}>{label}</option>)}
              </select>
            </div>
            {!orders ? <Skeleton className="h-40 w-full rounded-2xl" /> : visibleOrders.length === 0 ? (
              <p className="rounded-2xl border border-border p-8 text-center text-text-secondary">{filter ? "No orders in that state." : "No orders yet. Orders appear here once a customer has paid."}</p>
            ) : (
              <div className="space-y-8">
                {ORDER_GROUPS.map((group) => {
                  const inGroup = visibleOrders.filter((o: ServiceOrder) => group.states.includes(o.state));
                  if (!inGroup.length) return null;
                  return (
                    <section key={group.title} aria-label={group.title}>
                      <h2 className="type-title mb-3">{group.title} <span className="font-normal text-text-secondary tabular-nums">({inGroup.length})</span></h2>
                      <ul className="space-y-3">
                        {inGroup.map((order) => <li key={order.id}><ServiceOrderRow order={order} amountMinor={order.provider_net_minor} counterpart="Customer" /></li>)}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Listings */}
          <TabsContent value="listings" className="mt-6">
            {editing ? (
              <div className="max-w-3xl">
                <h2 className="type-title mb-4">{editing === "new" ? "New listing" : `Edit: ${editing.title}`}</h2>
                <ListingEditor
                  listing={editing === "new" ? null : editing}
                  categories={categories ?? []}
                  onCancel={() => setEditing(null)}
                  onSave={async (listing, packages) => {
                    await saveListing(profile.id, editing === "new" ? null : editing.id, listing, packages);
                    await refresh("provider-listings");
                    setEditing(null);
                    toast.success("Listing saved");
                  }}
                />
              </div>
            ) : (
              <>
                <Button variant="cta" className="rounded-full" onClick={() => setEditing("new")}><Plus aria-hidden /> New listing</Button>
                {!listings ? <Skeleton className="mt-5 h-40 w-full rounded-2xl" /> : listings.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-border p-8 text-center text-text-secondary">No listings yet. Create one, then submit it for review{approved ? "" : " once your profile is approved"}.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {listings.map((listing) => {
                      const activePackages = (listing.packages ?? []).filter((p) => p.is_active);
                      return (
                        <li key={listing.id} className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{listing.title}</p>
                              <p className="text-sm tabular-nums text-text-secondary">
                                {LISTING_STATUS_LABEL[listing.status]} · {activePackages.length} {activePackages.length === 1 ? "package" : "packages"}
                                {activePackages.length ? ` · from ${formatMinor(Math.min(...activePackages.map((p) => p.price_minor)))}` : ""}
                              </p>
                              {listing.review_note && <p className="mt-1 text-sm text-foreground"><span className="font-semibold">Note from 1145:</span> {listing.review_note}</p>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {listing.status === "published" && <Button asChild variant="ghost" size="sm"><Link to={`/hire/${listing.slug}`}>View <ArrowUpRight aria-hidden /></Link></Button>}
                              {listing.status !== "archived" && <Button variant="outline" size="sm" onClick={() => setEditing(listing)}>Edit</Button>}
                              {(listing.status === "draft" || listing.status === "changes_requested") && (
                                <Button variant="cta" size="sm" onClick={() => act(() => listingAction(listing.id, "submit"), "Submitted for review", "provider-listings")}>Submit for review</Button>
                              )}
                              {listing.status === "published" && <Button variant="outline" size="sm" onClick={() => act(() => listingAction(listing.id, "pause"), "Listing paused", "provider-listings")}>Pause</Button>}
                              {listing.status === "paused" && <Button variant="outline" size="sm" onClick={() => act(() => listingAction(listing.id, "resume"), "Listing resumed", "provider-listings")}>Resume</Button>}
                              {listing.status === "draft" ? (
                                <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Delete the draft "${listing.title}"?`)) void act(() => deleteDraftListing(listing.id), "Draft deleted", "provider-listings"); }}>Delete</Button>
                              ) : listing.status !== "archived" && (
                                <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Archive "${listing.title}"? It will be removed from the catalog. Existing orders continue.`)) void act(() => listingAction(listing.id, "archive"), "Listing archived", "provider-listings"); }}>Archive</Button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </TabsContent>

          {/* Earnings */}
          <TabsContent value="earnings" className="mt-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Owed to you", value: owed, hint: "Completed orders not yet paid out" },
                { label: "Paid out", value: paidOut, hint: "Payouts 1145 has recorded" },
                { label: "In progress", value: inProgress, hint: "Becomes owed when the order completes" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
                  <dt className="text-sm text-text-secondary">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatMinor(stat.value)}</dd>
                  <p className="mt-1 text-xs text-text-secondary">{stat.hint}</p>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-text-secondary">Amounts are after the 1145 fee. Payouts are made by 1145 and appear here once recorded; timing depends on 1145's payout schedule.</p>

            {(payments?.length ?? 0) > 0 && (
              <div className="table-scroll mt-6 rounded-2xl border border-border">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <caption className="sr-only">Earnings by order</caption>
                  <thead className="border-b border-border text-text-secondary">
                    <tr><th scope="col" className="p-3 font-medium">Order</th><th scope="col" className="p-3 font-medium">Customer paid</th><th scope="col" className="p-3 font-medium">1145 fee</th><th scope="col" className="p-3 font-medium">Refunded</th><th scope="col" className="p-3 font-medium">Your earnings</th><th scope="col" className="p-3 font-medium">Payout</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {payments!.map((p) => {
                      const order = (orders ?? []).find((o) => o.id === p.order_id);
                      return (
                        <tr key={p.id}>
                          <th scope="row" className="p-3 font-medium"><Link to={`/hire/orders/${p.order_id}`} className="underline underline-offset-4">{order?.order_number ?? "Order"}</Link></th>
                          <td className="p-3">{formatMinor(p.gross_amount_minor)}</td>
                          <td className="p-3">{formatMinor(p.marketplace_fee_minor)}</td>
                          <td className="p-3">{p.refunded_amount_minor ? formatMinor(p.refunded_amount_minor) : "—"}</td>
                          <td className="p-3 font-semibold">{formatMinor(p.provider_net_minor)}</td>
                          <td className="p-3">{{ not_due: "Not due yet", pending: "Owed", paid: `Paid${p.payout_ref ? ` · ${p.payout_ref}` : ""}`, cancelled: "Cancelled" }[p.payout_status]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {payments && payments.length === 0 && <p className="mt-6 rounded-2xl border border-border p-8 text-center text-text-secondary">No paid orders yet.</p>}
          </TabsContent>

          {/* Profile */}
          <TabsContent value="profile" className="mt-6 max-w-3xl">
            {contact ? <ProviderProfileForm key={profile.id} profile={profile} contact={contact} defaultEmail={user.email} onSave={saveProfile} /> : <Skeleton className="h-72 w-full rounded-2xl" />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProviderDashboardPage;
