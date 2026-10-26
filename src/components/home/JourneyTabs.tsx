import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LocateFixed, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { journeys, type Journey } from "@/content/home";
import { DELIVERY_AREAS, useDeliveryArea, useRideAvailability } from "@/hooks/useDeliveryArea";
import { track } from "@/lib/analytics";

/** Delivery area picker: a list, or the visitor's location when they ask for it. */
const AreaPicker: React.FC = () => {
  const { area, setArea, locate, locating, denied } = useDeliveryArea();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:p-2 sm:pl-4">
      <label htmlFor="delivery-area" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-brand" aria-hidden /> Delivering to
      </label>
      <select
        id="delivery-area"
        value={area?.id ?? ""}
        onChange={(e) => setArea(DELIVERY_AREAS.find((a) => a.id === e.target.value) ?? null)}
        className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:border-brand focus:outline-none"
      >
        <option value="">Choose your area</option>
        {DELIVERY_AREAS.map((a) => (
          <option key={a.id} value={a.id}>{a.label}, {a.province}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-brand transition-colors hover:bg-surface-selected"
      >
        <LocateFixed className="h-4 w-4" aria-hidden /> {locating ? "Locating…" : "Use my location"}
      </button>
      {denied && <p role="status" className="text-xs text-text-secondary sm:hidden">Location is off — pick your area from the list.</p>}
    </div>
  );
};

/** Honest ride status for the chosen area: never promises a ride that isn't there. */
const RideStatus: React.FC = () => {
  const { area } = useDeliveryArea();
  const { status, drivers } = useRideAvailability(area);

  const [dot, text] =
    !area ? ["bg-text-muted", "Choose your area to check ride availability."]
    : status === "checking" ? ["bg-text-muted animate-pulse", `Checking drivers near ${area.label}…`]
    : status === "live" ? ["bg-success", `${drivers} driver${drivers === 1 ? "" : "s"} online near ${area.label} right now.`]
    : status === "unavailable" ? ["bg-warning", `No drivers online near ${area.label} right now. Shopping and delivery still work.`]
    : ["bg-text-muted", "Ride availability is confirmed when you request a trip."];

  return (
    <p role="status" className="flex items-start gap-2 text-sm text-text-secondary">
      <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
      {text}
    </p>
  );
};

const Panel: React.FC<{ journey: Journey }> = ({ journey }) => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
    <div className="min-w-0">
      <h3 className="type-title text-foreground">{journey.headline}</h3>
      <p className="mt-2 text-text-secondary">{journey.summary}</p>
      {journey.id === "ride" && <div className="mt-4"><RideStatus /></div>}
      <Link
        to={journey.primary.to}
        onClick={() => track("category_click", { category: journey.id, placement: "journey_primary" })}
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
      >
        {journey.primary.label} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
    <ul className="grid grid-cols-2 gap-3">
      {journey.actions.map(({ title, desc, icon: Icon, to }) => (
        <li key={to} className="min-w-0">
          <Link
            to={to}
            onClick={() => track("category_click", { category: title, journey: journey.id, placement: "journey" })}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/40 hover:bg-surface-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-cyan">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{title}</span>
              <span className="block text-sm text-text-secondary">{desc}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Shop, Ride and Discover as three clearly separate journeys. Shop is
 * selected first because it is the immediate conversion; every destination
 * is one or two taps from here.
 */
const JourneyTabs: React.FC = () => {
  const [selected, setSelected] = useState<Journey["id"]>("shop");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = journeys.find((j) => j.id === selected)!;

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + journeys.length) % journeys.length;
    setSelected(journeys[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-labelledby="journeys-title" className="section-compact bg-surface-muted">
      <div className="page-container">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="journeys-title" className="type-headline">What do you need today?</h2>
          <div className="lg:w-[34rem]"><AreaPicker /></div>
        </div>

        <div role="tablist" aria-label="1145 services" className="grid grid-cols-3 gap-1 rounded-2xl bg-card p-1 shadow-soft sm:inline-grid sm:min-w-[24rem]">
          {journeys.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              ref={(el) => (tabRefs.current[i] = el)}
              role="tab"
              id={`journey-tab-${id}`}
              aria-selected={selected === id}
              aria-controls={`journey-panel-${id}`}
              tabIndex={selected === id ? 0 : -1}
              onClick={() => { setSelected(id); track("category_click", { category: id, placement: "journey_tab" }); }}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
                selected === id ? "bg-navy-900 text-white" : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", selected === id && "text-cyan")} aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`journey-panel-${current.id}`}
          aria-labelledby={`journey-tab-${current.id}`}
          className="mt-6 rounded-3xl border border-border bg-background p-5 sm:p-8"
        >
          <Panel journey={current} />
        </div>
      </div>
    </section>
  );
};

export default JourneyTabs;
