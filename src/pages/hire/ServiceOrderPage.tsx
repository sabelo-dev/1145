import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Loader2, Paperclip, Send, Star } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  adminOpenOrder, customerOrderAction, fetchOrderEvents, fetchOrderFiles, fetchOrderMessages, fetchOrderReview, fetchServiceOrder,
  formatMinor, getOrderFileUrl, payForServiceOrder, postOrderMessage, providerOrderAction, respondToReview, submitServiceBrief,
  submitServiceReview, uploadOrderFile, watchServiceOrder,
} from "@/services/serviceMarketplace";
import { cn } from "@/lib/utils";
import {
  EVENT_LABEL, ORDER_STATE_LABEL, SERVICE_FILE_ACCEPT, SERVICE_FILE_HELP,
  type ServiceOrder, type ServiceOrderFile,
} from "@/types/services";

type Role = "customer" | "provider" | "support";
const when = (iso: string) => new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** What each side should do next, in one sentence. */
const nextStep = (order: ServiceOrder, role: Role, justPaid: boolean): string => {
  const left = order.revisions_included - order.revisions_used;
  switch (order.state) {
    case "pending_payment": return role === "customer" ? (justPaid ? "We're confirming your payment. This usually takes a few seconds." : "This order hasn't been paid for yet.") : "Waiting for the customer's payment.";
    case "awaiting_brief": return role === "customer" ? "Payment confirmed. Fill in your brief below — work and the delivery time start once it's in." : "Paid. Waiting for the customer to complete their brief.";
    case "new": return role === "provider" ? "New order. Read the brief, then start work." : "Your brief is in. Waiting for the provider to start.";
    case "in_progress": return role === "provider" ? "You're working on this. Deliver it below when it's ready." : "The provider is working on your order.";
    case "waiting_for_customer": return role === "customer" ? "The provider needs something from you. Reply in the conversation to continue." : "Waiting for the customer to reply.";
    case "delivered": return role === "customer"
      ? `The work has been delivered. Accept it${left > 0 ? `, or request a revision (${left} left)` : ""}, or raise an issue if something is wrong.`
      : "Delivered. Waiting for the customer to review it.";
    case "revision_requested": return role === "provider" ? "The customer asked for a revision. Start it when you're ready." : "You asked for a revision. Waiting for the provider.";
    case "completed": return "This order is complete.";
    case "cancelled": return "This order was cancelled.";
    case "disputed": return "An issue was raised. 1145 support is reviewing it and will update this order.";
    case "refunded": return "This order was refunded.";
    case "partially_refunded": return "This order was partially refunded.";
  }
};

/** A button that opens a short note field before acting (reasons, questions, delivery notes). */
const NotedAction: React.FC<{
  label: string; prompt: string; confirmLabel: string; variant?: "cta" | "outline"; busy: boolean; withFiles?: boolean;
  onConfirm: (note: string, files: File[]) => Promise<void>;
}> = ({ label, prompt, confirmLabel, variant = "outline", busy, withFiles, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const id = React.useId();
  if (!open) return <Button variant={variant} className="rounded-full" disabled={busy} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <form
      className="w-full rounded-2xl border border-border bg-card p-4"
      onSubmit={async (e) => { e.preventDefault(); await onConfirm(note.trim(), files); }}
    >
      <Label htmlFor={id}>{prompt}</Label>
      <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} required autoFocus className="mt-1.5" />
      {withFiles && (
        <div className="mt-3">
          <Label htmlFor={`${id}-files`}>Attach deliverables (optional)</Label>
          <Input id={`${id}-files`} type="file" multiple accept={SERVICE_FILE_ACCEPT} className="mt-1.5" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <p className="mt-1 text-xs text-text-secondary">{SERVICE_FILE_HELP}</p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="cta" className="rounded-full" disabled={busy || !note.trim()}>{busy && <Loader2 className="animate-spin" aria-hidden />} {confirmLabel}</Button>
        <Button type="button" variant="ghost" className="rounded-full" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
};

/** The shared workspace for one service order: agreement, brief, conversation, files, delivery, review, history. */
const ServiceOrderPage: React.FC = () => {
  const { orderId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [brief, setBrief] = useState<Record<string, string> | null>(null);
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [supportReason, setSupportReason] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [response, setResponse] = useState("");
  const attachRef = useRef<HTMLInputElement>(null);

  const key = (part: string) => ["service-order", orderId, part];
  const { data: order, isLoading } = useQuery({
    queryKey: key("order"), queryFn: () => fetchServiceOrder(orderId), staleTime: 0,
    // Back from PayFast: the confirmation arrives separately, so check until it lands.
    refetchInterval: (query) => (justPaid && query.state.data?.state === "pending_payment" ? 3000 : false),
  });

  const role: Role | null = !order || !user ? null
    : order.customer_user_id === user.id ? "customer"
      : order.provider?.user_id === user.id ? "provider"
        : isAdmin ? "support" : null;
  // Support staff read private content only after logging why.
  const canReadPrivate = role === "customer" || role === "provider" || (role === "support" && supportOpen);
  const paid = !!order && order.state !== "pending_payment";

  const { data: messages } = useQuery({ queryKey: key("messages"), queryFn: () => fetchOrderMessages(orderId), enabled: canReadPrivate && paid, staleTime: 0 });
  const { data: files } = useQuery({ queryKey: key("files"), queryFn: () => fetchOrderFiles(orderId), enabled: canReadPrivate && paid, staleTime: 0 });
  const { data: events } = useQuery({ queryKey: key("events"), queryFn: () => fetchOrderEvents(orderId), enabled: !!order, staleTime: 0 });
  const { data: review } = useQuery({ queryKey: key("review"), queryFn: () => fetchOrderReview(orderId), enabled: order?.state === "completed", staleTime: 0 });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["service-order", orderId] });
  useEffect(() => {
    if (!orderId) return;
    return watchServiceOrder(orderId, () => { void queryClient.invalidateQueries({ queryKey: ["service-order", orderId] }); });
  }, [orderId, queryClient]);

  if (isLoading) return <div className="page-container py-10" aria-busy><Skeleton className="h-10 w-72" /><Skeleton className="mt-6 h-72 w-full rounded-2xl" /></div>;
  if (!order || !role || !user) {
    return (
      <div className="page-container py-20 text-center">
        <h1 className="type-title">We couldn't find that order</h1>
        <Link to="/hire/orders" className="link-arrow mt-4 justify-center text-foreground"><ArrowLeft aria-hidden /> My service orders</Link>
      </div>
    );
  }

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      if (done) toast.success(done);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const upload = async (list: File[], visibility: ServiceOrderFile["visibility"]) => {
    for (const file of list) await uploadOrderFile(order.id, user.id, file, visibility);
  };

  const briefValues = brief ?? order.brief_json ?? {};
  const canEditBrief = role === "customer" && (order.state === "awaiting_brief" || order.state === "new");
  const canTalk = paid && canReadPrivate && !["cancelled", "refunded"].includes(order.state);
  const revisionsLeft = order.revisions_included - order.revisions_used;
  const disputable = ["awaiting_brief", "new", "in_progress", "waiting_for_customer", "delivered", "revision_requested"].includes(order.state);
  const download = async (file: ServiceOrderFile) => {
    try { window.open(await getOrderFileUrl(file), "_blank", "noopener"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't open that file"); }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <SEO title={`${order.order_number} | 1145 Services`} noindex />
      <div className="page-container max-w-4xl py-6 md:py-10">
        <Link to={role === "provider" ? "/hire/provider" : role === "support" ? "/admin/dashboard" : "/hire/orders"} className="link-arrow min-h-[44px] text-text-secondary">
          <ArrowLeft aria-hidden /> {role === "provider" ? "Provider dashboard" : role === "support" ? "Admin" : "My service orders"}
        </Link>

        <p className="eyebrow mt-4 text-text-secondary">{order.order_number} · {role === "provider" ? "Customer order" : order.provider?.display_name ?? "Provider"}</p>
        <h1 className="type-headline mt-2">{order.listing_title}</h1>
        <p className="mt-3 inline-flex rounded-full bg-surface-selected px-3 py-1 text-sm font-semibold text-brand" aria-live="polite">{ORDER_STATE_LABEL[order.state]}</p>
        <p className="mt-3 text-foreground" role="status">
          {order.state === "pending_payment" && justPaid && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />}
          {nextStep(order, role, justPaid)}
        </p>

        {/* Actions for this state */}
        <div className="mt-5 flex flex-wrap items-start gap-3">
          {role === "customer" && order.state === "pending_payment" && (
            <>
              {!justPaid && <Button variant="cta" className="rounded-full" disabled={busy} onClick={() => run(() => payForServiceOrder(order.id, { email: user.email, name: user.name }))}>Pay {formatMinor(order.gross_amount_minor)}</Button>}
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => customerOrderAction(order.id, "cancel"), "Order cancelled")}>Cancel order</Button>
            </>
          )}
          {role === "customer" && order.state === "delivered" && (
            <>
              <Button variant="cta" className="rounded-full" disabled={busy} onClick={() => run(() => customerOrderAction(order.id, "accept"), "Delivery accepted")}>Accept delivery</Button>
              {revisionsLeft > 0 && (
                <NotedAction label={`Request a revision (${revisionsLeft} left)`} prompt="What needs to change? Keep it within what the package includes." confirmLabel="Request revision" busy={busy}
                  onConfirm={async (note) => { await run(() => customerOrderAction(order.id, "request_revision", note), "Revision requested"); }} />
              )}
            </>
          )}
          {role === "provider" && (order.state === "new" || order.state === "revision_requested") && (
            <Button variant="cta" className="rounded-full" disabled={busy} onClick={() => run(() => providerOrderAction(order.id, "start"), "Work started")}>
              {order.state === "new" ? "Start work" : "Start the revision"}
            </Button>
          )}
          {role === "provider" && (order.state === "in_progress" || order.state === "revision_requested") && (
            <NotedAction label="Deliver work" variant={order.state === "in_progress" ? "cta" : "outline"} prompt="Delivery note: what are you delivering, and anything the customer should know." confirmLabel="Submit delivery" busy={busy} withFiles
              onConfirm={async (note, list) => { await run(async () => { await upload(list, "delivery"); await providerOrderAction(order.id, "deliver", note); }, "Delivery submitted"); }} />
          )}
          {role === "provider" && order.state === "in_progress" && (
            <NotedAction label="I need something from the customer" prompt="What do you need? This is sent as a message and pauses the order until they reply." confirmLabel="Ask the customer" busy={busy}
              onConfirm={async (note) => { await run(() => providerOrderAction(order.id, "wait", note)); }} />
          )}
          {role === "provider" && order.state === "waiting_for_customer" && (
            <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => providerOrderAction(order.id, "resume"), "Work resumed")}>Continue without waiting</Button>
          )}
          {role !== "support" && disputable && !(role === "provider" && order.state === "awaiting_brief") && (
            <NotedAction label="Raise an issue" prompt="Describe the problem. 1145 support will review the order with both of you." confirmLabel="Send to support" busy={busy}
              onConfirm={async (note) => { await run(() => (role === "customer" ? customerOrderAction(order.id, "dispute", note) : providerOrderAction(order.id, "dispute", note)), "Issue sent to support"); }} />
          )}
        </div>

        {/* The agreement, as bought */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-5" aria-labelledby="agreement">
          <h2 id="agreement" className="type-title">What was ordered</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-text-secondary">Package</dt><dd className="font-medium text-foreground">{order.package_name}</dd></div>
            <div><dt className="text-text-secondary">{role === "provider" ? "Your earnings" : "Total paid"}</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {role === "provider" ? `${formatMinor(order.provider_net_minor)} (after a ${formatMinor(order.marketplace_fee_minor)} 1145 fee on ${formatMinor(order.gross_amount_minor)})` : formatMinor(order.gross_amount_minor)}
              </dd></div>
            <div><dt className="text-text-secondary">Delivery</dt>
              <dd className="font-medium tabular-nums text-foreground">{order.delivery_days} {order.delivery_days === 1 ? "day" : "days"}{order.due_at ? ` · due ${when(order.due_at)}` : " · starts when the brief is in"}</dd></div>
            <div><dt className="text-text-secondary">Revisions</dt><dd className="font-medium tabular-nums text-foreground">{order.revisions_used} of {order.revisions_included} used</dd></div>
            <div className="sm:col-span-2"><dt className="text-text-secondary">Included</dt><dd className="whitespace-pre-line text-foreground">{order.deliverables}</dd></div>
            {order.exclusions && <div className="sm:col-span-2"><dt className="text-text-secondary">Not included</dt><dd className="whitespace-pre-line text-foreground">{order.exclusions}</dd></div>}
          </dl>
          <p className="mt-4 text-xs text-text-secondary">These terms were fixed when the order was placed. Later changes to the listing don't affect this order.</p>
        </section>

        {/* Support gate */}
        {role === "support" && !supportOpen && (
          <form
            className="mt-8 rounded-2xl border border-border bg-surface-muted p-5"
            onSubmit={async (e) => { e.preventDefault(); if (await run(() => adminOpenOrder(order.id, supportReason.trim()))) setSupportOpen(true); }}
          >
            <h2 className="type-title">Support access</h2>
            <p className="mt-2 text-sm text-text-secondary">The brief, conversation and files are private to the customer and provider. Record why you need to read them; your access is logged.</p>
            <Label htmlFor="support-reason" className="mt-4 block">Reason</Label>
            <Input id="support-reason" value={supportReason} onChange={(e) => setSupportReason(e.target.value)} required className="mt-1.5 h-11" />
            <Button type="submit" variant="cta" className="mt-3 rounded-full" disabled={busy || !supportReason.trim()}>Open private content</Button>
          </form>
        )}

        {/* Brief */}
        {paid && order.brief_schema.length > 0 && (role !== "support" || supportOpen) && (
          <section className="mt-8" aria-labelledby="brief">
            <h2 id="brief" className="type-title">Brief</h2>
            {canEditBrief ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(async () => { await upload(briefFiles, "brief"); await submitServiceBrief(order.id, briefValues); }, "Brief saved")) { setBrief(null); setBriefFiles([]); }
                }}
              >
                {order.brief_schema.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={`brief-${field.key}`}>{field.label}{field.required ? "" : " (optional)"}</Label>
                    {field.type === "textarea" ? (
                      <Textarea id={`brief-${field.key}`} rows={4} maxLength={4000} required={field.required} className="mt-1.5"
                        value={briefValues[field.key] ?? ""} onChange={(e) => setBrief({ ...briefValues, [field.key]: e.target.value })} />
                    ) : (
                      <Input id={`brief-${field.key}`} maxLength={500} required={field.required} className="mt-1.5 h-11"
                        value={briefValues[field.key] ?? ""} onChange={(e) => setBrief({ ...briefValues, [field.key]: e.target.value })} />
                    )}
                  </div>
                ))}
                <div>
                  <Label htmlFor="brief-files">Reference files (optional)</Label>
                  <Input id="brief-files" type="file" multiple accept={SERVICE_FILE_ACCEPT} className="mt-1.5" onChange={(e) => setBriefFiles(Array.from(e.target.files ?? []))} />
                  <p className="mt-1 text-xs text-text-secondary">{SERVICE_FILE_HELP}</p>
                </div>
                <Button type="submit" variant="cta" className="rounded-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden />} {order.state === "awaiting_brief" ? "Submit brief" : "Update brief"}
                </Button>
              </form>
            ) : (
              <dl className="mt-4 space-y-3 rounded-2xl border border-border p-5 text-sm">
                {order.brief_schema.map((field) => (
                  <div key={field.key}>
                    <dt className="text-text-secondary">{field.label}</dt>
                    <dd className="whitespace-pre-line text-foreground">{order.brief_json?.[field.key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {/* Files */}
        {canReadPrivate && paid && (files?.length ?? 0) > 0 && (
          <section className="mt-8" aria-labelledby="files">
            <h2 id="files" className="type-title">Files</h2>
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
              {files!.map((file) => (
                <li key={file.id} className="flex items-center gap-3 p-3">
                  <FileText className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{file.original_filename}</span>
                    <span className="block text-xs text-text-secondary">
                      {file.visibility === "delivery" ? "Delivery" : file.visibility === "brief" ? "Brief" : "Attachment"} · {fileSize(file.size_bytes)} · {when(file.created_at)}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Download ${file.original_filename}`} onClick={() => download(file)}><Download aria-hidden /></Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-secondary">Files are private to this order. Download links expire after five minutes.</p>
          </section>
        )}

        {/* Conversation */}
        {canReadPrivate && paid && (
          <section className="mt-8" aria-labelledby="conversation">
            <h2 id="conversation" className="type-title">Conversation</h2>
            <p className="mt-1 text-sm text-text-secondary">Visible to the customer, the provider and, when an issue is raised, 1145 support. Keep everything about this order here.</p>
            {(messages?.length ?? 0) === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm text-text-secondary">No messages yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {messages!.map((m) => {
                  const mine = m.sender_user_id === user.id;
                  const who = mine ? "You" : m.sender_role === "customer" ? "Customer" : m.sender_role === "provider" ? (order.provider?.display_name ?? "Provider") : "1145 support";
                  return (
                    <li key={m.id} className={cn("max-w-[85%] rounded-2xl p-3", mine ? "ml-auto bg-surface-selected" : "bg-surface-muted")}>
                      <p className="text-xs font-semibold text-text-secondary">
                        {who}{m.kind === "delivery" ? " · Delivery note" : m.kind === "revision" ? " · Revision request" : ""} · {when(m.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-foreground">{m.message}</p>
                    </li>
                  );
                })}
              </ol>
            )}
            {canTalk && (
              <form
                className="mt-4 flex items-end gap-2"
                onSubmit={async (e) => { e.preventDefault(); const text = message.trim(); if (text && await run(() => postOrderMessage(order.id, text))) setMessage(""); }}
              >
                <div className="min-w-0 flex-1">
                  <Label htmlFor="order-message" className="sr-only">Message</Label>
                  <Textarea id="order-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={4000} placeholder="Write a message" />
                </div>
                {role !== "support" && (
                  <>
                    <input ref={attachRef} type="file" multiple accept={SERVICE_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden
                      onChange={async (e) => { const list = Array.from(e.target.files ?? []); e.target.value = ""; if (list.length) await run(() => upload(list, "message"), "File added"); }} />
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={busy} aria-label="Attach files" title={SERVICE_FILE_HELP} onClick={() => attachRef.current?.click()}>
                      <Paperclip aria-hidden />
                    </Button>
                  </>
                )}
                <Button type="submit" variant="cta" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !message.trim()} aria-label="Send message"><Send aria-hidden /></Button>
              </form>
            )}
          </section>
        )}

        {/* Review */}
        {order.state === "completed" && role !== "support" && (
          <section className="mt-8" aria-labelledby="review">
            <h2 id="review" className="type-title">Review</h2>
            {review ? (
              <div className="mt-4 rounded-2xl border border-border p-5">
                <p className="flex items-center gap-1" aria-label={`${review.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("h-5 w-5", i < review.rating ? "fill-current text-gold" : "text-border")} aria-hidden />)}
                </p>
                {review.review_text && <p className="mt-2 text-foreground">{review.review_text}</p>}
                {review.moderation_status === "removed" && <p className="mt-2 text-sm text-text-secondary">This review was removed by 1145 and is not shown publicly.</p>}
                {review.provider_response ? (
                  <p className="mt-3 border-l-2 border-border pl-3 text-sm text-text-secondary"><span className="font-medium text-foreground">Provider reply:</span> {review.provider_response}</p>
                ) : role === "provider" && (
                  <form className="mt-4" onSubmit={async (e) => { e.preventDefault(); await run(() => respondToReview(review.id, response.trim()), "Reply posted"); }}>
                    <Label htmlFor="review-response">Reply publicly</Label>
                    <Textarea id="review-response" value={response} onChange={(e) => setResponse(e.target.value)} rows={2} maxLength={2000} required className="mt-1.5" />
                    <Button type="submit" variant="outline" className="mt-2 rounded-full" disabled={busy || !response.trim()}>Post reply</Button>
                  </form>
                )}
              </div>
            ) : role === "customer" ? (
              <form className="mt-4 rounded-2xl border border-border p-5" onSubmit={async (e) => { e.preventDefault(); await run(() => submitServiceReview(order.id, rating, reviewText.trim()), "Thanks for your review"); }}>
                <fieldset>
                  <legend className="text-sm font-medium text-foreground">How was the service?</legend>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <label key={value} className="cursor-pointer rounded-full p-1 focus-within:ring-2 focus-within:ring-ring">
                        <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} className="sr-only" />
                        <Star className={cn("h-8 w-8", value <= rating ? "fill-current text-gold" : "text-border")} aria-hidden />
                        <span className="sr-only">{value} {value === 1 ? "star" : "stars"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Label htmlFor="review-text" className="mt-4 block">Your review (optional)</Label>
                <Textarea id="review-text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} maxLength={2000} className="mt-1.5" />
                <p className="mt-1 text-xs text-text-secondary">Reviews are public. Don't include private details from your order.</p>
                <Button type="submit" variant="cta" className="mt-3 rounded-full" disabled={busy || rating === 0}>Post review</Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-text-secondary">The customer hasn't left a review yet.</p>
            )}
          </section>
        )}

        {/* History */}
        <section className="mt-8" aria-labelledby="history">
          <h2 id="history" className="type-title">Order history</h2>
          <ol className="mt-4 space-y-2 text-sm">
            {(events ?? []).map((event) => (
              <li key={event.id} className="flex flex-wrap gap-x-3 border-l-2 border-border pl-3">
                <span className="tabular-nums text-text-secondary">{when(event.created_at)}</span>
                <span className="text-foreground">{EVENT_LABEL[event.event_type] ?? event.event_type.replace(/_/g, " ")}{event.reason ? `: ${event.reason}` : ""}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};

export default ServiceOrderPage;
