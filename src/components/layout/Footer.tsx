import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { subscribeToNewsletter } from "@/services/newsletterService";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const quickLinks = [
  { to: "/shop", label: "Shop" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/categories", label: "Categories" },
  { to: "/deals", label: "Deals & Promotions" },
  { to: "/new-arrivals", label: "New Arrivals" },
  { to: "/best-sellers", label: "Best Sellers" },
];

const serviceLinks = [
  { to: "/contact", label: "Contact Us" },
  { to: "/faq", label: "FAQ" },
  { to: "/shipping", label: "Shipping & Delivery" },
  { to: "/returns", label: "Returns & Refunds" },
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/privacy", label: "Privacy Policy" },
];

const socials = [
  { href: "https://facebook.com/lsionlinemall/", Icon: Facebook, label: "Facebook" },
  { href: "https://x.com/lsionlinemall/", Icon: Twitter, label: "X" },
  { href: "https://www.instagram.com/lsionlinemall/", Icon: Instagram, label: "Instagram" },
  { href: "https://youtube.com//@lsionlinemall", Icon: Youtube, label: "YouTube" },
];

const LinkList: React.FC<{ items: { to: string; label: string }[] }> = ({ items }) => (
  <ul className="space-y-2.5 text-sm text-gray-300">
    {items.map((l) => (
      <li key={l.to}>
        <Link to={l.to} className="inline-flex min-h-[32px] items-center hover:text-white">
          {l.label}
        </Link>
      </li>
    ))}
  </ul>
);

const ContactList: React.FC = () => (
  <ul className="space-y-3 text-sm text-gray-300">
    <li className="flex items-start">
      <MapPin size={18} className="mr-2 mt-0.5 flex-shrink-0" />
      <span>RSA</span>
    </li>
    <li className="flex items-center">
      <Phone size={18} className="mr-2 flex-shrink-0" />
      <a href="tel:+27602535492" className="hover:text-white">+27 (60) 253-5492</a>
    </li>
    <li className="flex items-center">
      <Mail size={18} className="mr-2 flex-shrink-0" />
      <a href="mailto:support@1145.io" className="hover:text-white break-all">support@1145.io</a>
    </li>
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
    <footer className="bg-wwe-navy text-white pt-10 md:pt-12 pb-6 pb-nav md:pb-6">
      <div className="wwe-container">
        {/* Brand */}
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="1145 Lifestyle" className="h-10 w-10 rounded-md" loading="lazy" />
            <span className="text-base font-semibold">1145 Lifestyle</span>
          </div>
          <p className="mt-3 text-sm text-gray-300">
            A next-generation commerce ecosystem to shop, travel, transact and monetize — all in one platform.
          </p>
          <div className="mt-4 flex gap-5">
            {socials.map(({ href, Icon, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-gray-300 hover:text-white"
              >
                <Icon size={20} />
              </a>
            ))}
          </div>

          {/* Collapsible sections keep the mobile footer short */}
          <Accordion type="single" collapsible className="mt-6 border-t border-white/10">
            <AccordionItem value="quick" className="border-white/10">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Quick Links</AccordionTrigger>
              <AccordionContent><LinkList items={quickLinks} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="service" className="border-white/10">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Customer Service</AccordionTrigger>
              <AccordionContent><LinkList items={serviceLinks} /></AccordionContent>
            </AccordionItem>
            <AccordionItem value="contact" className="border-white/10">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Contact Us</AccordionTrigger>
              <AccordionContent><ContactList /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Desktop columns */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <img src="/logo.png" alt="1145 Lifestyle" className="h-10 w-10 rounded-md mb-3" loading="lazy" />
            <h3 className="text-lg font-semibold mb-4">About 1145 Lifestyle</h3>
            <p className="text-sm text-gray-300 mb-4">
              1145 is a next-generation e-commerce ecosystem, designed to empower businesses of all sizes to sell online with ease and users across all walks of life to transact, shop, travel and monetize in one platform.
            </p>
            <div className="flex space-x-4 mt-4">
              {socials.map(({ href, Icon, label }) => (
                <a key={label} href={href} aria-label={label} className="text-gray-300 hover:text-white">
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <LinkList items={quickLinks} />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Customer Service</h3>
            <LinkList items={serviceLinks} />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ContactList />
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-gray-700 mt-8 md:mt-10 pt-6 md:pt-8 pb-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h4 className="text-base md:text-lg font-semibold mb-1.5">Subscribe to our Newsletter</h4>
              <p className="text-sm text-gray-300">
                Get the latest news, updates and special offers in your inbox.
              </p>
            </div>
            <form className="flex w-full md:w-auto" onSubmit={submitNewsletter}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Your Email Address"
                aria-label="Email address"
                value={newsletterEmail}
                onChange={(event) => {
                  setNewsletterEmail(event.target.value);
                  setIsSubscribed(false);
                }}
                disabled={isSubscribing || isSubscribed}
                className="h-11 px-4 rounded-l-xl w-full md:w-auto bg-gray-800 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-wwe-gold text-white text-base"
              />
              <button type="submit" disabled={isSubscribing || isSubscribed} className={`h-11 shrink-0 px-4 font-medium rounded-r-xl disabled:opacity-100 ${isSubscribed ? "bg-emerald-600 text-white" : "bg-wwe-gold text-wwe-navy hover:bg-opacity-90"}`}>
                {isSubscribed ? "Subscribed" : isSubscribing ? "Subscribing…" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>

        <div className="text-center text-xs md:text-sm text-gray-400 mt-6 md:mt-8">
          <p>&copy; {currentYear} 1145 Lifestyle. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
