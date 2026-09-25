import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Building2, Car, Coins, KeyRound, Megaphone, Package, Shield, ShoppingBag, Store, Truck, Wallet, Zap,
} from "lucide-react";
import SEO from "@/components/SEO";

type Service = { name: string; description: string; icon: typeof Car; route: string; tag?: string };

/** Same names and order as the home page. */
const everyday: Service[] = [
  { name: "Shop", description: "Browse and buy from local merchants and the 1145 store.", icon: ShoppingBag, route: "/shop", tag: "Popular" },
  { name: "Ride", description: "Get a lift anywhere in the city, now or scheduled.", icon: Car, route: "/rides/request" },
  { name: "Send", description: "Courier parcels across town with live tracking.", icon: Package, route: "/package/send" },
  { name: "Wallet", description: "Pay, top up, withdraw and hold value in gold.", icon: Wallet, route: "/wallet" },
  { name: "Lease", description: "Rent-to-own electronics, vehicles and equipment.", icon: KeyRound, route: "/lease/marketplace", tag: "New" },
  { name: "Stay", description: "Book hotels, lodges and holiday rentals.", icon: Building2, route: "/stays", tag: "New" },
  { name: "UCoin", description: "Spend and trade the rewards you earn on 1145.", icon: Coins, route: "/ucoin-market" },
];

const earn: Service[] = [
  { name: "Drive", description: "Deliver rides and parcels on your own schedule.", icon: Truck, route: "/driver/register", tag: "Earn" },
  { name: "Sell", description: "Open a store and reach customers nationwide.", icon: Store, route: "/merchant/register" },
  { name: "Create", description: "Grow your audience and get paid for content.", icon: Megaphone, route: "/influencer/login" },
];

const highlights = [
  { icon: Shield, label: "Secure payments", desc: "Bank-grade encryption" },
  { icon: Zap, label: "Fast delivery", desc: "Same-day in major cities" },
  { icon: Coins, label: "Rewards", desc: "Earn UCoin on everything" },
];

const ServiceCard = ({ service }: { service: Service }) => (
  <Link
    to={service.route}
    className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-elevated"
  >
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-input text-foreground transition-colors group-hover:bg-navy-900 group-hover:text-cyan">
        <service.icon className="h-6 w-6" />
      </span>
      {service.tag ? (
        <span className="rounded-full bg-navy-900 px-2.5 py-1 text-[11px] font-semibold text-white">{service.tag}</span>
      ) : (
        <ArrowUpRight className="h-5 w-5 text-text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      )}
    </div>
    <h3 className="mt-5 text-lg font-semibold">{service.name}</h3>
    <p className="mt-1 text-sm text-text-secondary">{service.description}</p>
  </Link>
);

const ServiceHubPage = React.forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="min-h-screen bg-background">
    <SEO title="Services | 1145" description="Shop, ride, send, pay, lease and stay — plus ways to earn with 1145." />

    <section className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Services</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Everything you need, one app.</h1>
        <p className="mt-3 max-w-xl text-text-secondary">Get around, get things delivered, and manage your money — or start earning with 1145.</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, label, desc }) => (
            <li key={label} className="flex items-center gap-3 rounded-2xl bg-background p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-cyan"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-text-secondary">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <h2 className="mb-5 text-2xl font-bold">Get around &amp; get things</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {everyday.map((s) => <ServiceCard key={s.name} service={s} />)}
      </div>

      <h2 className="mb-5 mt-12 text-2xl font-bold">Earn with 1145</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {earn.map((s) => <ServiceCard key={s.name} service={s} />)}
      </div>
    </section>
  </div>
));

ServiceHubPage.displayName = "ServiceHubPage";

export default ServiceHubPage;
