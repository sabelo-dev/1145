import {
  BadgeCheck, Briefcase, Building2, Car, CircleHelp, Gift, KeyRound, Megaphone, Package, PackageSearch, RotateCcw, ShieldCheck,
  ShoppingBag, Sparkles, Store, Truck, UtensilsCrossed, Wallet, type LucideIcon,
} from "lucide-react";
import { OFFICIAL_STORE_PATH } from "@/lib/officialStore";

/**
 * Home-page content. Layout components read from here so campaigns can be
 * swapped without touching markup. Only reference live routes and real,
 * approved imagery — nothing here may promise what the product can't do.
 */

export interface HomeImage {
  src: string;
  /** Describes what is pictured; shown to screen readers. */
  alt: string;
  width: number;
  height: number;
}

/** The single campaign that leads the page. */
export const heroCampaign = {
  eyebrow: "Drop 001",
  title: "Wear the time.",
  description: "Official 1145 apparel. Hoodies, tracksuits, caps and training wear in five signature colours.",
  primary: { label: "Shop the drop", to: OFFICIAL_STORE_PATH },
  secondary: { label: "Explore 1145 services", to: "/services" },
  image: {
    src: "/images/drop-001/hoodie_black.webp",
    alt: "Black 1145 TIME hoodie with a small circular 1145 emblem on the chest",
    width: 720,
    height: 720,
  } satisfies HomeImage,
  caption: "TIME Hoodie",
};

export interface CollectionTile {
  name: string;
  /** Finishes the sentence "Shop …" for the link's accessible name. */
  linkLabel: string;
  to: string;
  image: HomeImage;
}

/** Pieces of the current drop; each opens a filtered shop view. */
export const collections: CollectionTile[] = [
  {
    name: "Hoodies",
    linkLabel: "Shop hoodies",
    to: "/shop?search=hoodie",
    image: { src: "/images/drop-001/hoodie_black.webp", alt: "Black 1145 hoodie", width: 720, height: 720 },
  },
  {
    name: "Tracksuits",
    linkLabel: "Shop tracksuits",
    to: "/shop?search=track",
    image: { src: "/images/drop-001/tracksuit_stone.webp", alt: "Stone 1145 zip-up tracksuit set", width: 720, height: 720 },
  },
  {
    name: "Caps",
    linkLabel: "Shop caps",
    to: "/shop?search=cap",
    image: { src: "/images/drop-001/cap_red.webp", alt: "Red 1145 cap", width: 720, height: 720 },
  },
  {
    name: "Training",
    linkLabel: "Shop training wear",
    to: "/shop?search=legging",
    image: { src: "/images/drop-001/legging_navy.webp", alt: "Navy 1145 training legging", width: 720, height: 720 },
  },
];

export interface QuickStartLink {
  title: string;
  desc: string;
  /** Visible on wider screens; the whole card is the link. */
  cta: string;
  icon: LucideIcon;
  to: string;
}

/** The most common jobs, one tap from the top of the home page. */
export const quickStart: QuickStartLink[] = [
  { title: "Get a ride", desc: "Request a lift now or schedule one for later.", cta: "Request a ride", icon: Car, to: "/rides/request" },
  { title: "Grab a bite", desc: "Order from eateries in the 1145 Food Court.", cta: "Open the Food Court", icon: UtensilsCrossed, to: "/food" },
  { title: "Shop the marketplace", desc: "Browse products from the 1145 store and local merchants.", cta: "Open the marketplace", icon: ShoppingBag, to: "/shop" },
  { title: "Find a place to stay", desc: "Hotels, guesthouses, lodges and more.", cta: "Browse stays", icon: Building2, to: "/stays" },
];

export interface ServiceLink {
  name: string;
  desc: string;
  icon: LucideIcon;
  href: string;
}

/** Same names and order as the Services page. */
export const services: ServiceLink[] = [
  { name: "Shop", desc: "Marketplace", icon: ShoppingBag, href: "/shop" },
  { name: "Ride", desc: "Get a lift", icon: Car, href: "/rides/request" },
  { name: "Eat", desc: "Eateries, delivered", icon: UtensilsCrossed, href: "/food" },
  { name: "Send", desc: "Parcels & courier", icon: Package, href: "/package/send" },
  { name: "Wallet", desc: "Money & gold", icon: Wallet, href: "/wallet" },
  { name: "Lease", desc: "Rent-to-own", icon: KeyRound, href: "/lease/marketplace" },
  { name: "Stay", desc: "Book a stay", icon: Building2, href: "/stays" },
  { name: "Hire", desc: "Pros for the job", icon: Briefcase, href: "/hire" },
];

export interface HelpLink {
  title: string;
  desc: string;
  icon: LucideIcon;
  to: string;
}

/** Factual pointers to policy and support pages — no promises made here. */
export const helpLinks: HelpLink[] = [
  { title: "Delivery", desc: "Options, costs and timeframes", icon: Truck, to: "/shipping" },
  { title: "Returns & refunds", desc: "How to send something back", icon: RotateCcw, to: "/returns" },
  { title: "Track an order", desc: "See where your order is", icon: PackageSearch, to: "/track-order" },
  { title: "Help & contact", desc: "FAQs and our support team", icon: CircleHelp, to: "/contact" },
];

/* ── Homepage v2 ─────────────────────────────────────────────────────
   Shopping is the immediate conversion; Ride is a clearly separate
   service; merchant sign-up is the visible secondary path. */

/** Lead value proposition. The download is the primary action. */
export const valueProp = {
  eyebrow: "Shop · Ride · Discover",
  title: "Everything you need. One app.",
  description:
    "Shop South African brands and local merchants, request a ride, and discover food, stays and services — paid securely and delivered to your door.",
  primary: { label: "Download 1145", to: "/downloads" },
  secondary: { label: "Explore the marketplace", to: "/shop" },
  /** Real product shots from the current drop, priced from the catalogue when it loads. */
  image: {
    src: "/images/drop-001/hoodie_black.webp",
    alt: "Black XIXLV TIME hoodie with a small circular 1145 emblem on the chest",
    width: 720,
    height: 720,
  } satisfies HomeImage,
  secondaryImage: {
    src: "/images/drop-001/tracksuit_stone.webp",
    alt: "Stone XIXLV zip-up tracksuit set",
    width: 720,
    height: 720,
  } satisfies HomeImage,
};

/** Popular searches offered under the search box before the visitor types. */
export const popularSearches = ["Hoodies", "Sneakers", "Headphones", "Tracksuits", "Phone accessories", "Caps"];

export interface JourneyAction {
  title: string;
  desc: string;
  icon: LucideIcon;
  to: string;
}

export interface Journey {
  id: "shop" | "ride" | "discover";
  label: string;
  icon: LucideIcon;
  headline: string;
  summary: string;
  primary: { label: string; to: string };
  actions: JourneyAction[];
}

/** The three journeys. Every link is a live route. */
export const journeys: Journey[] = [
  {
    id: "shop",
    label: "Shop",
    icon: ShoppingBag,
    headline: "Shop local brands, delivered.",
    summary: "Fashion, tech and everyday essentials from verified South African merchants, priced in rand.",
    primary: { label: "Start shopping", to: "/shop" },
    actions: [
      { title: "Marketplace", desc: "Every product on 1145", icon: ShoppingBag, to: "/shop" },
      { title: "XIXLV official store", desc: "The 1145 house brand", icon: Store, to: OFFICIAL_STORE_PATH },
      { title: "Deals", desc: "Current price drops", icon: Megaphone, to: "/deals" },
      { title: "Food Court", desc: "Eateries, delivered", icon: UtensilsCrossed, to: "/food" },
    ],
  },
  {
    id: "ride",
    label: "Ride",
    icon: Car,
    headline: "Rides with verified drivers.",
    summary: "PIN-verified trips, live tracking and a panic button on every ride — where 1145 Ride operates.",
    primary: { label: "Request a ride", to: "/rides/request" },
    actions: [
      { title: "Request a ride", desc: "Now or scheduled", icon: Car, to: "/rides/request" },
      { title: "Send a parcel", desc: "Courier across town", icon: Package, to: "/package/send" },
      { title: "Your trips", desc: "History and receipts", icon: PackageSearch, to: "/rides" },
      { title: "Drive with 1145", desc: "Earn on your schedule", icon: KeyRound, to: "/driver/register" },
    ],
  },
  {
    id: "discover",
    label: "Discover",
    icon: Building2,
    headline: "Discover more in one account.",
    summary: "Stays, trusted pros, rent-to-own and a wallet that earns UCoin rewards.",
    primary: { label: "All services", to: "/services" },
    actions: [
      { title: "Stays", desc: "Hotels, lodges, guesthouses", icon: Building2, to: "/stays" },
      { title: "Hire a pro", desc: "Pros for the job", icon: Briefcase, to: "/hire" },
      { title: "Lease", desc: "Rent-to-own", icon: KeyRound, to: "/lease/marketplace" },
      { title: "Wallet", desc: "Money, gold & UCoin", icon: Wallet, to: "/wallet" },
    ],
  },
];

export interface TrustPoint {
  title: string;
  desc: string;
  icon: LucideIcon;
  to: string;
}

/** Each statement mirrors the linked policy page. */
export const trustPoints: TrustPoint[] = [
  { title: "Secure payments", desc: "Card, Instant EFT and SnapScan via PayFast", icon: ShieldCheck, to: "/faq" },
  { title: "Free delivery over R1 000", desc: "Standard delivery from R99", icon: Truck, to: "/shipping" },
  { title: "30-day returns", desc: "Refunds within 3–5 business days", icon: RotateCcw, to: "/returns" },
  { title: "Verified merchants", desc: "Every store is approved by 1145", icon: BadgeCheck, to: "/faq" },
];

/**
 * The XIXLV DROP competition. Used when no "hero" banner is scheduled in
 * the admin CMS; a scheduled banner replaces the title, image, link and dates.
 */
export const dropCampaign = {
  eyebrow: "XIXLV DROP",
  title: "Your chance to share R15,000 in shopping vouchers.",
  steps: [
    { title: "Download", desc: "Get the 1145 app." },
    { title: "Register", desc: "Create your free account." },
    { title: "Share", desc: "Invite friends with your link." },
  ],
  cta: { label: "Enter now", to: "/downloads" },
  closes: "2027-02-27T23:59:59+02:00",
  terms: { label: "Terms apply", to: "/terms" },
  image: {
    src: "/images/drop-001/cap_red.webp",
    alt: "Red XIXLV cap from the current drop",
    width: 720,
    height: 720,
  } satisfies HomeImage,
};

/** Organic growth: creators and referrals. Rewards match the live UCoin rules. */
export const growthPrograms = [
  {
    id: "referral",
    eyebrow: "Refer a friend",
    title: "Share 1145, earn 200 UC.",
    desc: "Send your personal download link. When a friend signs in to a 1145 app for the first time, you earn 200 UCoin to spend anywhere on 1145.",
    cta: { label: "Get your invite link", to: "/downloads" },
    icon: Gift,
  },
  {
    id: "creator",
    eyebrow: "Creator programme",
    title: "Create content. Earn commission.",
    desc: "Connect your social accounts, promote the products you love and track conversions and earnings from your creator dashboard.",
    cta: { label: "Become a creator", to: "/influencer/login" },
    icon: Sparkles,
  },
] as const;
