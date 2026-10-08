import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminFetchAllCategories, adminFetchAudit, adminFetchListings, adminFetchOrders, adminFetchProviders, adminFetchReviews,
  adminModerateReview, adminRecordPayout, adminRecordRefund, adminResolveDispute, adminReviewListing, adminReviewProvider,
  adminSaveCategory, adminSetFee, fetchMarketplaceFeeBps, fetchServicePayments, formatMinor, parseMinor,
} from "@/services/serviceMarketplace";
import {
  LISTING_STATUS_LABEL, ORDER_STATE_LABEL, PROVIDER_STATUS_LABEL,
  type ServiceOrder, type ServiceOrderState, type ServicePayment,
} from "@/types/services";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { dateStyle: "medium" });
const moment = (iso: string) => new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });

/** Asks for a reason. Returns null if the admin cancels or leaves it empty when one is required. */
const askReason = (question: string, required = true): string | null => {
  const answer = window.prompt(question, "");
  if (answer === null) return null;
  if (required && !answer.trim()) { toast.error("A reason is required"); return null; }
  return answer.trim();
};

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="py-6 text-muted-foreground">{children}</p>;

/** Service marketplace operations: moderation, order oversight, finance and settings. */
const AdminServiceMarketplace: React.FC = () => {
  const queryClient = useQueryClient();
  const q = <T,>(name: string, queryFn: () => Promise<T>) => ({ queryKey: ["admin-services", name], queryFn, staleTime: 0 });
  const providers = useQuery(q("providers", adminFetchProviders));
  const listings = useQuery(q("listings", adminFetchListings));
  const orders = useQuery(q("orders", adminFetchOrders));
  const payments = useQuery(q("payments", fetchServicePayments));
  const reviews = useQuery(q("reviews", adminFetchReviews));
  const categories = useQuery(q("categories", adminFetchAllCategories));
  const fee = useQuery(q("fee", fetchMarketplaceFeeBps));
  const audit = useQuery(q("audit", adminFetchAudit));

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<ServiceOrderState | "">("");
  const [newCategory, setNewCategory] = useState("");
  const [feeInput, setFeeInput] = useState("");

  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      toast.success(done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work");
    }
  };

  const paymentByOrder = useMemo(() => new Map((payments.data ?? []).map((p) => [p.order_id, p])), [payments.data]);
  const shownOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (orders.data ?? []).filter((o) =>
      (!stateFilter || o.state === stateFilter)
      && (!needle || [o.order_number, o.listing_title, o.provider?.display_name ?? "", o.customer_user_id, o.id].some((t) => t.toLowerCase().includes(needle))));
  }, [orders.data, search, stateFilter]);

  const pendingProviders = (providers.data ?? []).filter((p) => p.onboarding_status === "submitted" || p.onboarding_status === "under_review").length;
  const pendingListings = (listings.data ?? []).filter((l) => l.status === "submitted").length;
  const disputes = (orders.data ?? []).filter((o) => o.state === "disputed").length;
  const refundsDue = (payments.data ?? []).filter((p) => p.status === "refund_due");
  const payoutsDue = (payments.data ?? []).filter((p) => p.payout_status === "pending");

  const refund = (order: ServiceOrder, payment: ServicePayment) => {
    const remaining = payment.gross_amount_minor - payment.refunded_amount_minor;
    const amountText = window.prompt(`Refund amount in rand for ${order.order_number} (up to ${formatMinor(remaining)}). Refund it in PayFast first, then record it here.`, (remaining / 100).toFixed(2));
    if (amountText === null) return;
    const amount = parseMinor(amountText);
    if (!amount) { toast.error("Enter a valid amount, e.g. 150.00"); return; }
    const reference = askReason("PayFast refund reference:");
    if (!reference) return;
    const reason = askReason("Reason for the refund (kept in the audit trail):");
    if (!reason) return;
    void act(() => adminRecordRefund(order.id, amount, reference, reason), "Refund recorded");
  };

  const payout = (order: ServiceOrder | undefined, payment: ServicePayment) => {
    const reference = askReason(`Payout reference for ${order?.order_number ?? "this order"} (${formatMinor(payment.provider_net_minor - payment.refunded_amount_minor)}). Make the payment first, then record it here.`);
    if (reference) void act(() => adminRecordPayout(payment.order_id, reference), "Payout recorded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service marketplace</CardTitle>
        <CardDescription>
          {pendingProviders} provider {pendingProviders === 1 ? "application" : "applications"} and {pendingListings} {pendingListings === 1 ? "listing" : "listings"} to review ·{" "}
          {disputes} open {disputes === 1 ? "issue" : "issues"} · {refundsDue.length} {refundsDue.length === 1 ? "refund" : "refunds"} due · {payoutsDue.length} {payoutsDue.length === 1 ? "payout" : "payouts"} due
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="providers">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="finance">Refunds &amp; payouts</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="settings">Fee &amp; categories</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>

          {/* Providers */}
          <TabsContent value="providers">
            {providers.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : providers.isError ? <Empty>Couldn't load providers. Has the service marketplace migration been applied?</Empty>
              : !providers.data?.length ? <Empty>No provider applications yet.</Empty> : (
                <ul className="divide-y divide-border">
                  {providers.data.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                      <div className="min-w-0 max-w-2xl">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">{p.display_name} <Badge variant="outline">{PROVIDER_STATUS_LABEL[p.onboarding_status]}</Badge></p>
                        <p className="text-sm text-muted-foreground">{[p.location, p.service_mode.replace("_", " "), `applied ${day(p.created_at)}`].filter(Boolean).join(" · ")}</p>
                        {p.bio && <p className="mt-1 whitespace-pre-line text-sm text-foreground">{p.bio}</p>}
                        {p.portfolio.length > 0 && (
                          <p className="mt-1 text-sm">Portfolio: {p.portfolio.map((item, i) => (
                            <React.Fragment key={item.url}>{i > 0 && ", "}<a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{item.title}</a></React.Fragment>
                          ))} {p.portfolio_rights_confirmed ? "(rights confirmed)" : "(rights NOT confirmed)"}</p>
                        )}
                        {p.review_note && <p className="mt-1 text-sm text-muted-foreground">Last note: {p.review_note}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {p.onboarding_status === "submitted" && <Button size="sm" variant="outline" onClick={() => act(() => adminReviewProvider(p.id, "under_review"), "Marked under review")}>Start review</Button>}
                        {p.onboarding_status !== "approved" && <Button size="sm" onClick={() => act(() => adminReviewProvider(p.id, "approved"), `${p.display_name} approved`)}>{p.onboarding_status === "suspended" ? "Restore" : "Approve"}</Button>}
                        {["submitted", "under_review"].includes(p.onboarding_status) && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { const r = askReason("What should the provider change?"); if (r) void act(() => adminReviewProvider(p.id, "changes_requested", r), "Changes requested"); }}>Request changes</Button>
                            <Button size="sm" variant="outline" onClick={() => { const r = askReason("Reason for rejecting this application:"); if (r) void act(() => adminReviewProvider(p.id, "rejected", r), "Application rejected"); }}>Reject</Button>
                          </>
                        )}
                        {p.onboarding_status === "approved" && <Button size="sm" variant="outline" onClick={() => { const r = askReason("Reason for suspending this provider (their listings will be hidden):"); if (r) void act(() => adminReviewProvider(p.id, "suspended", r), "Provider suspended"); }}>Suspend</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </TabsContent>

          {/* Listings */}
          <TabsContent value="listings">
            {listings.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : !listings.data?.length ? <Empty>No listings have been submitted yet.</Empty> : (
              <ul className="divide-y divide-border">
                {listings.data.map((l) => {
                  const active = (l.packages ?? []).filter((p) => p.is_active);
                  return (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                      <div className="min-w-0 max-w-2xl">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">{l.title} <Badge variant="outline">{LISTING_STATUS_LABEL[l.status]}</Badge></p>
                        <p className="text-sm text-muted-foreground">{l.provider?.display_name ?? "Unknown provider"} · {l.category?.name ?? "No category"} · {day(l.created_at)}</p>
                        {l.summary && <p className="mt-1 text-sm text-foreground">{l.summary}</p>}
                        <details className="mt-1 text-sm">
                          <summary className="cursor-pointer text-muted-foreground">Description, packages and brief</summary>
                          <p className="mt-2 whitespace-pre-line text-foreground">{l.description}</p>
                          {l.exclusions && <p className="mt-2 whitespace-pre-line text-muted-foreground">Not included: {l.exclusions}</p>}
                          <ul className="mt-2 space-y-1 tabular-nums">
                            {active.map((p) => <li key={p.id}><span className="font-medium">{p.name}</span> — {formatMinor(p.price_minor)}, {p.delivery_days} days, {p.revisions_included} revisions. {p.deliverables}</li>)}
                          </ul>
                          {l.required_brief_schema.length > 0 && <p className="mt-2 text-muted-foreground">Brief: {l.required_brief_schema.map((f) => `${f.label}${f.required ? " (required)" : ""}`).join("; ")}</p>}
                        </details>
                        {l.review_note && <p className="mt-1 text-sm text-muted-foreground">Last note: {l.review_note}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {l.status !== "published" && <Button size="sm" onClick={() => act(() => adminReviewListing(l.id, "published"), "Listing published")}>Publish</Button>}
                        {l.status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { const r = askReason("What should the provider change?"); if (r) void act(() => adminReviewListing(l.id, "changes_requested", r), "Changes requested"); }}>Request changes</Button>
                            <Button size="sm" variant="outline" onClick={() => { const r = askReason("Reason for rejecting this listing:"); if (r) void act(() => adminReviewListing(l.id, "rejected", r), "Listing rejected"); }}>Reject</Button>
                          </>
                        )}
                        {l.status === "published" && <Button size="sm" variant="outline" onClick={() => { const r = askReason("Reason for pausing this listing:"); if (r) void act(() => adminReviewListing(l.id, "paused", r), "Listing paused"); }}>Pause</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders">
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="svc-order-search">Search</Label>
                <Input id="svc-order-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number, service, provider or customer ID" className="mt-1.5 w-80 max-w-full" />
              </div>
              <div>
                <Label htmlFor="svc-order-state">Status</Label>
                <select id="svc-order-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value as ServiceOrderState | "")} className="mt-1.5 block h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="">All</option>
                  {Object.entries(ORDER_STATE_LABEL).map(([state, label]) => <option key={state} value={state}>{label}</option>)}
                </select>
              </div>
            </div>
            {orders.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : shownOrders.length === 0 ? <Empty>No orders match.</Empty> : (
              <ul className="divide-y divide-border">
                {shownOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        <Link to={`/hire/orders/${o.id}`} className="underline underline-offset-4">{o.order_number}</Link> {o.listing_title}
                        <Badge variant={o.state === "disputed" ? "destructive" : "outline"}>{ORDER_STATE_LABEL[o.state]}</Badge>
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {o.provider?.display_name ?? "Provider"} · {formatMinor(o.gross_amount_minor)} (fee {formatMinor(o.marketplace_fee_minor)}) · placed {day(o.created_at)}{o.due_at ? ` · due ${day(o.due_at)}` : ""}
                      </p>
                    </div>
                    {o.state === "disputed" && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { const r = askReason("Resolution note — work continues where it left off:"); if (r) void act(() => adminResolveDispute(o.id, "resume", r), "Order resumed"); }}>Resume order</Button>
                        <Button size="sm" variant="outline" onClick={() => { const r = askReason("Resolution note — complete the order in the provider's favour:"); if (r) void act(() => adminResolveDispute(o.id, "complete", r), "Order completed"); }}>Complete</Button>
                        <Button size="sm" variant="outline" onClick={() => { const r = askReason("Resolution note — cancel the order in the customer's favour (a refund becomes due):"); if (r) void act(() => adminResolveDispute(o.id, "cancel", r), "Order cancelled; refund due"); }}>Cancel &amp; refund</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-muted-foreground">Opening an order shows its timeline. Reading its messages and files asks for a reason, which is logged.</p>
          </TabsContent>

          {/* Finance */}
          <TabsContent value="finance">
            <p className="mt-4 text-sm text-muted-foreground">
              PayFast does the money movement. Make the refund or payout there (or by bank transfer) first, then record its reference here. Recording is what updates the order, the provider's earnings and the audit trail.
            </p>
            {payments.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : !payments.data?.length ? <Empty>No payments yet.</Empty> : (
              <div className="table-scroll mt-4">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <caption className="sr-only">Service payments, refunds and payouts</caption>
                  <thead className="border-b border-border text-muted-foreground">
                    <tr><th scope="col" className="p-2 font-medium">Order</th><th scope="col" className="p-2 font-medium">Paid</th><th scope="col" className="p-2 font-medium">Gross</th><th scope="col" className="p-2 font-medium">1145 fee</th><th scope="col" className="p-2 font-medium">Provider net</th><th scope="col" className="p-2 font-medium">Refunded</th><th scope="col" className="p-2 font-medium">Payment</th><th scope="col" className="p-2 font-medium">Payout</th><th scope="col" className="p-2 font-medium">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {payments.data.map((p) => {
                      const order = (orders.data ?? []).find((o) => o.id === p.order_id);
                      const refundable = p.payout_status !== "paid" && p.refunded_amount_minor < p.gross_amount_minor;
                      return (
                        <tr key={p.id}>
                          <th scope="row" className="p-2 font-medium"><Link to={`/hire/orders/${p.order_id}`} className="underline underline-offset-4">{order?.order_number ?? p.order_id.slice(0, 8)}</Link></th>
                          <td className="p-2">{day(p.paid_at)}</td>
                          <td className="p-2">{formatMinor(p.gross_amount_minor)}</td>
                          <td className="p-2">{formatMinor(p.marketplace_fee_minor)}</td>
                          <td className="p-2">{formatMinor(p.provider_net_minor)}</td>
                          <td className="p-2">{p.refunded_amount_minor ? formatMinor(p.refunded_amount_minor) : "—"}</td>
                          <td className="p-2">{p.status.replace(/_/g, " ")}</td>
                          <td className="p-2">{p.payout_status.replace(/_/g, " ")}{p.payout_ref ? ` · ${p.payout_ref}` : ""}</td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              {order && refundable && <Button size="sm" variant="outline" onClick={() => refund(order, p)}>Record refund</Button>}
                              {p.payout_status === "pending" && <Button size="sm" onClick={() => payout(order, p)}>Record payout</Button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {paymentByOrder.size > 0 && (
              <p className="mt-3 text-sm tabular-nums text-muted-foreground">
                Owed to providers: {formatMinor(payoutsDue.reduce((sum, p) => sum + p.provider_net_minor - p.refunded_amount_minor, 0))} ·
                Refunds due: {formatMinor(refundsDue.reduce((sum, p) => sum + p.gross_amount_minor - p.refunded_amount_minor, 0))}
              </p>
            )}
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews">
            {reviews.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : !reviews.data?.length ? <Empty>No reviews yet.</Empty> : (
              <ul className="divide-y divide-border">
                {reviews.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div className="min-w-0 max-w-2xl">
                      <p className="font-semibold text-foreground">{r.rating} / 5 {r.moderation_status === "removed" && <Badge variant="destructive">Removed</Badge>}</p>
                      {r.review_text && <p className="mt-1 text-sm text-foreground">{r.review_text}</p>}
                      {r.provider_response && <p className="mt-1 text-sm text-muted-foreground">Provider reply: {r.provider_response}</p>}
                      <p className="mt-1 text-sm text-muted-foreground">{day(r.created_at)} · <Link to={`/hire/orders/${r.order_id}`} className="underline underline-offset-4">order</Link></p>
                    </div>
                    {r.moderation_status === "published"
                      ? <Button size="sm" variant="outline" onClick={() => { const reason = askReason("Reason for removing this review:"); if (reason) void act(() => adminModerateReview(r.id, "removed", reason), "Review removed"); }}>Remove</Button>
                      : <Button size="sm" variant="outline" onClick={() => { const reason = askReason("Reason for restoring this review:"); if (reason) void act(() => adminModerateReview(r.id, "published", reason), "Review restored"); }}>Restore</Button>}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <section className="mt-4" aria-labelledby="fee-title">
              <h3 id="fee-title" className="font-semibold text-foreground">Marketplace fee</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Currently <span className="font-semibold tabular-nums text-foreground">{fee.data != null ? `${(fee.data / 100).toFixed(2)}%` : "…"}</span> of the package price, taken from the provider's earnings.
                A change applies to new orders only; every existing order keeps the rate it was bought at.
              </p>
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const percent = Number(feeInput.replace(",", "."));
                  if (feeInput.trim() === "" || Number.isNaN(percent) || percent < 0 || percent > 50) { toast.error("Enter a percentage between 0 and 50"); return; }
                  const reason = askReason("Reason for changing the fee (kept in the audit trail):");
                  if (reason) void act(() => adminSetFee(Math.round(percent * 100), reason), "Fee updated").then(() => setFeeInput(""));
                }}
              >
                <div>
                  <Label htmlFor="svc-fee">New fee (%)</Label>
                  <Input id="svc-fee" inputMode="decimal" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} placeholder="10" className="mt-1.5 w-28" />
                </div>
                <Button type="submit" variant="outline">Change fee</Button>
              </form>
            </section>

            <section className="mt-8" aria-labelledby="categories-title">
              <h3 id="categories-title" className="font-semibold text-foreground">Categories</h3>
              <ul className="mt-2 divide-y divide-border">
                {(categories.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={c.is_active ? "text-foreground" : "text-muted-foreground line-through"}>{c.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => act(() => adminSaveCategory({ ...c, is_active: !c.is_active }), c.is_active ? "Category hidden" : "Category shown")}>{c.is_active ? "Hide" : "Show"}</Button>
                  </li>
                ))}
              </ul>
              <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const name = newCategory.trim(); if (name.length >= 2) void act(() => adminSaveCategory({ name, sort_order: (categories.data?.length ?? 0) + 1, is_active: true }), "Category added").then(() => setNewCategory("")); }}>
                <div>
                  <Label htmlFor="svc-category">New category</Label>
                  <Input id="svc-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={60} className="mt-1.5 w-64" />
                </div>
                <Button type="submit" variant="outline" disabled={newCategory.trim().length < 2}>Add</Button>
              </form>
            </section>
          </TabsContent>

          {/* Audit */}
          <TabsContent value="audit">
            {audit.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : !audit.data?.length ? <Empty>Nothing recorded yet.</Empty> : (
              <div className="table-scroll mt-4">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <caption className="sr-only">Latest 200 audited actions</caption>
                  <thead className="border-b border-border text-muted-foreground">
                    <tr><th scope="col" className="p-2 font-medium">When</th><th scope="col" className="p-2 font-medium">Action</th><th scope="col" className="p-2 font-medium">On</th><th scope="col" className="p-2 font-medium">By</th><th scope="col" className="p-2 font-medium">Reason</th><th scope="col" className="p-2 font-medium">Details</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {audit.data.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2 tabular-nums">{moment(a.created_at)}</td>
                        <td className="p-2 font-medium">{a.action.replace(/_/g, " ")}</td>
                        <td className="p-2">{a.entity_type}{a.entity_id ? ` ${a.entity_id.slice(0, 8)}` : ""}</td>
                        <td className="p-2">{a.actor_user_id ? a.actor_user_id.slice(0, 8) : "system"}</td>
                        <td className="p-2">{a.reason ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">{Object.keys(a.metadata_json ?? {}).length ? JSON.stringify(a.metadata_json) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminServiceMarketplace;
