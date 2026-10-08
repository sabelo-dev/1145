import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { subscribeToNewsletter } from "@/services/newsletterService";
import { toast } from "sonner";
import { OFFICIAL_STORE_PATH } from "@/lib/officialStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const shopLinks = [
  { to: "/shop", label: "Shop" },
  { to: OFFICIAL_STORE_PATH, label: "Marketplace" },
  { to: "/categories", label: "Categories" },
  { to: "/deals", label: "Deals" },
  { to: "/new-arrivals", label: "New arrivals" },
  { to: "/best-sellers", label: "Best sellers" },
];

const serviceLinks = [
  { to: "/services", label: "All services" },
  { to: "/rides/request", label: "Ride" },
  { to: "/food", label: "Food delivery" },
  { to: "/hire", label: "Hire a pro" },
  { to: "/package/send", label: "Send a parcel" },
  { to: "/stays", label: "Stays" },
  { to: "/lease/marketplace", label: "Lease" },
  { to: "/wallet", label: "Wallet" },
];

const helpLinks = [
  { to: "/contact", label: "Contact us" },
  { to: "/faq", label: "FAQ" },
  { to: "/track-order", label: "Track an order" },
  { to: "/shipping", label: "Shipping & delivery" },
  { to: "/returns", label: "Returns & refunds" },
  { to: "/rewards-guide", label: "Rewards guide" },
];

const partnerLinks = [
  { to: "/merchant/register", label: "Sell on 1145" },
  { to: "/driver/register", label: "Drive with 1145" },
  { to: "/eatery/dashboard", label: "List your eatery" },
  { to: "/hire/provider", label: "Offer a service" },
  { to: "/influencer/login", label: "Creator hub" },
];

const legalLinks = [
  { to: "/terms", label: "Terms & conditions" },
  { to: "/privacy", label: "Privacy policy" },
];

const groups = [
  { id: "shop", title: "Shop", items: shopLinks },
  { id: "services", title: "Services", items: serviceLinks },
  { id: "help", title: "Help", items: helpLinks },
  { id: "partners", title: "Partner with 1145", items: partnerLinks },
];

const socials = [
  { href: "https://facebook.com/lsionlinemall/", Icon: Facebook, label: "Facebook" },
  { href: "https://x.com/lsionlinemall/", Icon: Twitter, label: "X" },
  { href: "https://www.instagram.com/lsionlinemall/", Icon: Instagram, label: "Instagram" },
  { href: "https://youtube.com/@lsionlinemall", Icon: Youtube, label: "YouTube" },
];

const LinkList: React.FC<{ items: { to: string; label: string }[] }> = ({ items }) => (
  <ul className="space-y-1 text-sm text-white/70">
    {items.map((l) => (
      <li key={l.to}>
        <Link to={l.to} className="inline-flex min-h-[36px] items-center transition-colors hover:text-white">
          {l.label}
        </Link>
      </li>
    ))}
  </ul>
);

const ContactList: React.FC = () => (
  <ul className="space-y-2 text-sm text-white/70">
    <li className="flex items-center gap-2">
      <Phone size={16} className="shrink-0" aria-hidden />
      <a href="tel:+27602535492" className="inline-flex min-h-[36px] items-center transition-colors hover:text-white">+27 (60) 253-5492</a>
    </li>
    <li className="flex items-center gap-2">
      <Mail size={16} className="shrink-0" aria-hidden />
      <a href="mailto:support@1145.io" className="inline-flex min-h-[36px] items-center break-all transition-colors hover:text-white">support@1145.io</a>
    </li>
    <li className="flex min-h-[36px] items-center gap-2">
      <MapPin size={16} className="shrink-0" aria-hidden />
      <span>South Africa</span>
    </li>
  </ul>
);

const Socials: React.FC = () => (
  <ul className="flex gap-2">
    {socials.map(({ href, Icon, label }) => (
      <li key={label}>
        <a
          href={href}
          aria-label={"1145 on " + label}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon size={18} aria-hidden />
        </a>
      </li>
    ))}
  </ul>
);

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const submitNewsletter = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeToNewsletter(email);
      setNewsletterEmail("");
      setIsSubscribed(true);
      toast.success("You’re subscribed to our newsletter.");
    } catch {
      toast.error("We couldn’t subscribe you right now. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <footer className="bg-navy-900 pb-nav pt-12 text-white md:pb-8 md:pt-16">
      <div className="page-container">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)] lg:gap-16">
          {/* Brand and contact */}
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" loading="lazy" />
              <span className="font-display text-lg font-bold tracking-tight">1145 Lifestyle</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              A next-generation commerce ecosystem to shop, travel, transact and monetize — all in one platform.
            </p>
            <div className="mt-5">
              <ContactList />
            </div>
            <div className="mt-5">
              <Socials />
            </div>
          </div>

          {/* Link groups: collapsible on phones, columns from md up */}
          <nav aria-label="Footer">
            <Accordion type="single" collapsible className="border-t border-white/10 md:hidden">
              {groups.map((g) => (
                <AccordionItem key={g.id} value={g.id} className="border-white/10">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline">{g.title}</AccordionTrigger>
                  <AccordionContent><LinkList items={g.items} /></AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="hidden gap-8 md:grid md:grid-cols-4">
              {groups.map((g) => (
                <div key={g.id}>
                  <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-white">{g.title}</h2>
                  <LinkList items={g.items} />
                </div>
              ))}
            </div>
          </nav>
        </div>

        {/* Newsletter */}
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-sans text-base font-semibold tracking-normal text-white">Subscribe to our newsletter</h2>
            <p className="mt-1 text-sm text-white/70">Get the latest news, updates and special offers in your inbox.</p>
          </div>
          <form className="flex w-full md:w-auto" onSubmit={submitNewsletter}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Your email address"
              aria-label="Email address"
              value={newsletterEmail}
              onChange={(event) => {
                setNewsletterEmail(event.target.value);
                setIsSubscribed(false);
              }}
              disabled={isSubscribing || isSubscribed}
              className="h-12 w-full rounded-l-full border border-white/20 bg-white/5 px-5 text-base text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none md:w-72"
            />
            <button
              type="submit"
              disabled={isSubscribing || isSubscribed}
              className={
                "h-12 shrink-0 rounded-r-full px-5 text-sm font-semibold transition-colors disabled:opacity-100 " +
                (isSubscribed ? "bg-success text-success-foreground" : "bg-white text-navy-900 hover:bg-white/90")
              }
            >
              {isSubscribed ? "Subscribed" : isSubscribing ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between md:text-sm">
          <p>&copy; {currentYear} 1145 Lifestyle. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-6">
            {legalLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="inline-flex min-h-[36px] items-center transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
