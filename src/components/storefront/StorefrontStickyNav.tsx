import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Store, Crown, Shield, MessageSquare, ArrowLeft, Share2, Heart, MapPin, Star, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface StorefrontStickyNavProps {
  storeName: string;
  logoUrl?: string;
  accentColor: string;
  vendorTier: string;
  sellerBadge?: string | null;
  avgRating: number;
  totalProducts: number;
  description?: string;
  createdAt?: string;
  hasContactForm: boolean;
  hasTrustIndicators: boolean;
  showPlatformBranding: boolean;
  sections: string[];
}

const StorefrontStickyNav: React.FC<StorefrontStickyNavProps> = ({
  storeName,
  logoUrl,
  accentColor,
  vendorTier,
  sellerBadge,
  avgRating,
  totalProducts,
  description,
  createdAt,
  hasContactForm,
  hasTrustIndicators,
  showPlatformBranding,
  sections,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 300);

      // Detect active section
      const sectionIds = ["collections", "spotlight", "products", "about", "testimonials", "faq"];
      for (const id of sectionIds.reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 150) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "spotlight", label: "Featured" },
    { id: "collections", label: "Collections" },
    { id: "products", label: "Products" },
    { id: "about", label: "About" },
    { id: "testimonials", label: "Reviews" },
  ].filter((item) => sections.includes(item.id) || item.id === "products");

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className={`sticky top-0 z-30 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-lg shadow-sm border-b border-border/50"
          : "bg-card/80 backdrop-blur-sm border-b"
      }`}
      style={vendorTier !== "starter" ? { borderBottomColor: `${accentColor}15` } : {}}
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Main header row */}
        <div className="flex items-center gap-3 md:gap-4 py-3 md:py-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className={`object-cover rounded-full ring-2 ring-background shadow-md transition-all ${
                  scrolled ? "w-8 h-8" : "w-12 h-12 md:w-14 md:h-14"
                }`}
              />
            ) : (
              <div
                className={`rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-background shadow-md transition-all ${
                  scrolled ? "w-8 h-8" : "w-12 h-12 md:w-14 md:h-14"
                }`}
              >
                <Store className={scrolled ? "h-4 w-4 text-primary" : "h-6 w-6 text-primary"} />
              </div>
            )}
          </div>

          {/* Store info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className={`font-bold text-foreground truncate transition-all ${
                  scrolled ? "text-sm" : "text-lg md:text-xl"
                }`}
              >
                {storeName}
              </h1>
              {sellerBadge && (
                <Badge
                  className="gap-1 text-[10px] flex-shrink-0 rounded-full text-white"
                  style={{
                    backgroundColor: vendorTier === "gold" ? "#eab308" : accentColor,
                  }}
                >
                  {vendorTier === "gold" ? (
                    <Crown className="h-2.5 w-2.5" />
                  ) : (
                    <Shield className="h-2.5 w-2.5" />
                  )}
                  <span className="hidden sm:inline">{sellerBadge}</span>
                </Badge>
              )}
            </div>

            {!scrolled && (
              <div className="flex items-center gap-2 md:gap-3 flex-wrap text-xs md:text-sm mt-0.5">
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground hidden sm:inline">
                      ({totalProducts})
                    </span>
                  </div>
                )}
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>South Africa</span>
                </div>
                {hasTrustIndicators && createdAt && (
                  <>
                    <span className="text-muted-foreground hidden md:inline">·</span>
                    <div className="hidden md:flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Joined {format(new Date(createdAt), "MMM yyyy")}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {!scrolled && description && vendorTier !== "starter" && (
              <p className="text-muted-foreground mt-1 text-xs md:text-sm max-w-xl hidden md:block">
                {description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {hasContactForm && (
              <Button variant="outline" size="sm" className="rounded-full hidden sm:flex">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Contact
              </Button>
            )}
            {showPlatformBranding && (
              <Link to="/shop">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <ArrowLeft className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">Shop</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Section navigation tabs */}
        {navItems.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeSection === item.id
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                style={
                  activeSection === item.id
                    ? { backgroundColor: accentColor }
                    : {}
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontStickyNav;
