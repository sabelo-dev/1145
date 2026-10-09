import {
  Building2, Car, CircleHelp, KeyRound, Megaphone, Package, PackageSearch, RotateCcw, ShoppingBag, Store, Truck,
  Wallet, type LucideIcon,
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
  description: "Official XIXLV apparel. Hoodies, tracksuits, caps and training wear in five signature colours.",
  primary: { label: "Shop the drop", to: OFFICIAL_STORE_PATH },
  secondary: { label: "Explore XIXLV services", to: "/services" },
  image: {
    src: "/images/drop-001/hoodie_black.webp",
    alt: "Black XIXLV TIME hoodie with a small circular XIXLV emblem on the chest",
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
  { name: "Send", desc: "Parcels & courier", icon: Package, href: "/package/send" },
  { name: "Wallet", desc: "Money & gold", icon: Wallet, href: "/wallet" },
  { name: "Lease", desc: "Rent-to-own", icon: KeyRound, href: "/lease/marketplace" },
  { name: "Stay", desc: "Book a stay", icon: Building2, href: "/stays" },
  { name: "Sell", desc: "Open a store", icon: Store, href: "/merchant/register" },
  { name: "Create", desc: "Creator hub", icon: Megaphone, href: "/influencer/login" },
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
