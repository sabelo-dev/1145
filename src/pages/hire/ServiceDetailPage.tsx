import React, { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Briefcase, Clock, Loader2, MapPin, RefreshCcw, Star } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  createServiceOrder, fetchListingBySlug, fetchProviderRatings, fetchProviderReviews, formatMinor, payForServiceOrder,
} from "@/services/serviceMarketplace";
import { cn } from "@/lib/utils";
import { SERVICE_FILE_HELP } from "@/types/services";

const MODE_LABEL = { remote: "Works remotely", in_person: "Works in person", both: "Remote or in person" } as const;

/** One listing: what you get, what it costs, what the provider needs, and the order button. */
const ServiceDetailPage: React.FC = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One key per checkout attempt, so a double click or retry can't create two orders.
  const attemptKey = useRef<string>(crypto.randomUUID());

  const { data: listing, isLoading } = useQuery({ queryKey: ["service-listing", slug], queryFn: () => fetchListingBySlug(slug), staleTime: 60_000 });
  const providerId = listing?.provider_id;
  const { data: ratings } = useQuery({ queryKey: ["service-ratings"], queryFn: fetchProviderRatings, staleTime: 300_000 });
  const { data: reviews } = useQuery({ queryKey: ["service-reviews", providerId], queryFn: () => fetchProviderReviews(providerId!), enabled: !!providerId, staleTime: 300_000 });

  if (isLoading) {
    return <div className="page-container py-8" aria-busy><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-72 w-full rounded-2xl" /></div>;
  }
  const packages = listing?.packages ?? [];
  if (!listing || listing.status !== "published" || !listing.provider || packages.length === 0) {
    return (
      <div className="page-container py-20 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
        <h1 className="type-title mt-4">This service isn't available</h1>
        <Link to="/hire" className="link-arrow mt-4 justify-center text-foreground"><ArrowLeft aria-hidden /> All services</Link>
      </div>
    );
  }

  const provider = listing.provider;
  const selected = packages.find((p) => p.id === selectedId) ?? packages[0];
  const rating = ratings?.get(listing.provider_id);
  const ownListing = user?.id === provider.user_id;
  const required = listing.required_brief_schema.filter((f) => f.required);

  const order = async () => {
    if (!user) { navigate("/login", { state: { from: `/hire/${listing.slug}` } }); return; }
    setFailure(null);
    setSubmitting(true);
    let orderId: string;
    try {
      orderId = await createServiceOrder(selected.id, attemptKey.current);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "We couldn't create your order. Please try again.");
      setSubmitting(false);
      return;
    }
    try {
      await payForServiceOrder(orderId, { email: user.email, name: user.name });
    } catch {
      // The order exists; its page can retry the payment.
      navigate(`/hire/orders/${orderId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <SEO title={`${listing.title} | 1145 Services`} description={listing.summary || undefined} />
      <div className="page-container pt-4">
        <Link to="/hire" className="link-arrow min-h-[44px] text-text-secondary"><ArrowLeft aria-hidden /> All services</Link>
      </div>

      <div className="page-container mt-2 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {listing.category && <p className="eyebrow text-text-secondary">{listing.category.name}</p>}
          <h1 className="type-headline mt-2">{listing.title}</h1>
          {listing.summary && <p className="type-lead mt-3 text-text-secondary">{listing.summary}</p>}

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              {provider.display_name} <BadgeCheck className="h-4 w-4 text-brand" aria-hidden />
              <span className="font-normal text-text-secondary">Approved by 1145</span>
            </span>
            {rating && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star className="h-4 w-4 fill-current text-gold" aria-hidden /> {rating.average_rating.toFixed(1)} from {rating.review_count} reviews
              </span>
            )}
          </p>

          {listing.image_url && <img src={listing.image_url} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl bg-surface-muted object-cover" />}

          <section className="mt-8" aria-labelledby="about-service">
            <h2 id="about-service" className="type-title">About this service</h2>
            <p className="mt-3 whitespace-pre-line text-foreground">{listing.description}</p>
          </section>

          {listing.exclusions && (
            <section className="mt-8" aria-labelledby="not-included">
              <h2 id="not-included" className="type-title">Not included</h2>
              <p className="mt-3 whitespace-pre-line text-text-secondary">{listing.exclusions}</p>
            </section>
          )}

          <section className="mt-8" aria-labelledby="what-needed">
            <h2 id="what-needed" className="type-title">What the provider needs from you</h2>
            {listing.required_brief_schema.length === 0 ? (
              <p className="mt-3 text-text-secondary">Nothing up front. You can message the provider and share files once you've ordered.</p>
            ) : (
              <>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-foreground">
                  {listing.required_brief_schema.map((f) => <li key={f.key}>{f.label}{f.required ? "" : " (optional)"}</li>)}
                </ul>
                <p className="mt-3 text-sm text-text-secondary">
                  You fill this in right after paying{required.length ? ", and the delivery time starts once the required answers are in" : ""}. You can attach files too: {SERVICE_FILE_HELP}
                </p>
              </>
            )}
          </section>

          <section className="mt-8" aria-labelledby="how-it-works">
            <h2 id="how-it-works" className="type-title">Revisions, cancellations and support</h2>
            <ul className="mt-3 space-y-2 text-text-secondary">
              <li>A revision is a change to the delivered work that stays within what the package includes. New or extra work is a new order.</li>
              <li>You can cancel before paying. After payment, raise an issue on the order and 1145 support will review it with you and the provider.</li>
              <li>Refunds are decided by 1145 support and returned through the original payment method. <Link to="/returns" className="font-medium text-foreground underline underline-offset-4">Refund policy</Link> · <Link to="/contact" className="font-medium text-foreground underline underline-offset-4">Contact support</Link></li>
            </ul>
          </section>

          <section className="mt-8 rounded-2xl border border-border p-5" aria-labelledby="about-provider">
            <h2 id="about-provider" className="type-title">About {provider.display_name}</h2>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
              {provider.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {provider.location}</span>}
              <span>{MODE_LABEL[provider.service_mode]}</span>
            </p>
            {provider.bio && <p className="mt-3 whitespace-pre-line text-foreground">{provider.bio}</p>}
            {provider.portfolio.length > 0 && (
              <>
                <h3 className="mt-4 font-sans text-sm font-semibold tracking-normal text-foreground">Portfolio</h3>
                <ul className="mt-2 space-y-1">
                  {provider.portfolio.map((item) => (
                    <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-medium text-foreground underline underline-offset-4">{item.title}<span className="sr-only"> (opens in a new tab)</span></a></li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {reviews && reviews.length > 0 && (
            <section className="mt-8" aria-labelledby="reviews-title">
              <h2 id="reviews-title" className="type-title">Reviews from completed orders</h2>
              <ul className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-2xl border border-border p-4">
                    <p className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("h-4 w-4", i < review.rating ? "fill-current text-gold" : "text-border")} aria-hidden />)}
                      <span className="ml-2 font-normal text-text-secondary">{new Date(review.created_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}</span>
                    </p>
                    {review.review_text && <p className="mt-2 text-foreground">{review.review_text}</p>}
                    {review.provider_response && <p className="mt-3 border-l-2 border-border pl-3 text-sm text-text-secondary"><span className="font-medium text-foreground">{provider.display_name} replied:</span> {review.provider_response}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Packages and order */}
        <aside aria-label="Choose a package">
          <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <fieldset>
              <legend className="type-title">{packages.length > 1 ? "Choose a package" : "Package"}</legend>
              <div className="mt-4 space-y-3">
                {packages.map((pkg) => {
                  const checked = pkg.id === selected.id;
                  return (
                    <label key={pkg.id} className={cn("block cursor-pointer rounded-xl border p-4 transition-colors", checked ? "border-foreground bg-surface-selected" : "border-border hover:border-foreground/30")}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                          {packages.length > 1 && <input type="radio" name="package" className="h-4 w-4 accent-[hsl(var(--brand))]" checked={checked} onChange={() => setSelectedId(pkg.id)} />}
                          {pkg.name}
                        </span>
                        <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground">{formatMinor(pkg.price_minor)}</span>
                      </span>
                      {pkg.description && <span className="mt-1 block text-sm text-text-secondary">{pkg.description}</span>}
                      <span className="mt-3 block whitespace-pre-line text-sm text-foreground"><span className="font-medium">Includes: </span>{pkg.deliverables}</span>
                      <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary tabular-nums">
                        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden /> {pkg.delivery_days} {pkg.delivery_days === 1 ? "day" : "days"} delivery</span>
                        <span className="inline-flex items-center gap-1"><RefreshCcw className="h-4 w-4" aria-hidden /> {pkg.revisions_included === 0 ? "No revisions" : `${pkg.revisions_included} ${pkg.revisions_included === 1 ? "revision" : "revisions"}`}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm tabular-nums">
              <div className="flex justify-between"><dt className="text-text-secondary">{selected.name} from {provider.display_name}</dt><dd>{formatMinor(selected.price_minor)}</dd></div>
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total to pay</dt><dd>{formatMinor(selected.price_minor)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-text-secondary">
              Estimated delivery {selected.delivery_days} {selected.delivery_days === 1 ? "day" : "days"} after {required.length ? "you submit your brief" : "payment is confirmed"}.
            </p>

            {failure && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>}

            {ownListing ? (
              <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm text-text-secondary">This is your own listing. <Link to="/hire/provider" className="font-medium text-foreground underline underline-offset-4">Manage it</Link></p>
            ) : (
              <Button variant="cta" size="lg" className="mt-4 w-full rounded-full" disabled={submitting} onClick={order}>
                {submitting ? <><Loader2 className="animate-spin" aria-hidden /> Taking you to payment…</> : user ? `Order and pay ${formatMinor(selected.price_minor)}` : "Sign in to order"}
              </Button>
            )}
            <p className="mt-3 text-xs text-text-secondary">
              You pay securely with PayFast. Your order is confirmed when the payment is, and the price shown is checked against the listing when you order.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ServiceDetailPage;
