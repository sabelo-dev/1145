import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Car, Package, Wallet, Briefcase, ArrowRight, KeyRound, Sparkles, TrendingUp, Shield, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const services = [
  {
    id: "commerce",
    name: "Shop",
    description: "Browse and buy products from local merchants",
    icon: ShoppingBag,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    route: "/shop",
    tag: "Popular",
  },
  {
    id: "rides",
    name: "Travel",
    description: "Request a ride to your destination",
    icon: Car,
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    route: "/rides",
    tag: null,
  },
  {
    id: "delivery",
    name: "Drive",
    description: "Deliver packages and earn on your schedule",
    icon: Package,
    gradient: "from-rose-500 to-pink-600",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    route: "/driver/dashboard",
    tag: "Earn",
  },
  {
    id: "wallet",
    name: "Transact",
    description: "Manage your money, payments, and transfers",
    icon: Wallet,
    gradient: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    route: "/wallet",
    tag: null,
  },
  {
    id: "lease",
    name: "Lease",
    description: "Lease electronics, vehicles, and equipment",
    icon: KeyRound,
    gradient: "from-teal-500 to-cyan-500",
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-500",
    route: "/shop?listing_type=lease",
    tag: "New",
  },
  {
    id: "business",
    name: "Business",
    description: "Tools for merchants and service providers",
    icon: Briefcase,
    gradient: "from-emerald-500 to-green-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    route: "/merchant/dashboard",
    tag: null,
  },
];

const highlights = [
  { icon: Shield, label: "Secure Payments", desc: "End-to-end encrypted" },
  { icon: Zap, label: "Fast Delivery", desc: "Same-day available" },
  { icon: TrendingUp, label: "Best Prices", desc: "Gold-backed pricing" },
];

const ServiceHubPage = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div ref={ref} className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary to-purple-700">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-400/10 blur-3xl animate-float" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-400/5 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 pt-12 pb-20 md:pt-16 md:pb-28 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Text content */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-xs font-medium text-white/90">Your Super App</span>
                </div>
              </div>

              {user && (
                <p className="text-white/60 text-sm mb-2 font-medium">
                  Welcome back, {user.name || user.email?.split("@")[0]}
                </p>
              )}

              <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight leading-[1.1]">
                Everything you need,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">
                  one platform.
                </span>
              </h1>

              <p className="text-base md:text-lg text-white/70 max-w-lg mb-8 leading-relaxed">
                Shop, Travel, Transact, and grow your business — all powered by gold-backed value.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate("/shop")}
                  className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg px-6 rounded-xl"
                >
                  Start Shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  onClick={() => navigate("/merchant/onboarding")}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold rounded-xl px-6"
                >
                  Become a Merchant
                </Button>
              </div>
            </div>

            {/* Right: Hero Slideshow */}
            <HeroSlideshow />
          </div>
        </div>
      </div>

      {/* Highlights Bar */}
      <div className="container mx-auto px-4 -mt-8 relative z-20 mb-8">
        <div className="glass rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="grid grid-cols-3 gap-4">
            {highlights.map((h) => (
              <div key={h.label} className="flex items-center gap-3 justify-center">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <h.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-foreground">{h.label}</p>
                  <p className="text-[10px] text-muted-foreground">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="container mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Services</h2>
            <p className="text-sm text-muted-foreground">Everything at your fingertips</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card
                key={service.id}
                className="group cursor-pointer border border-border/50 bg-card shadow-sm hover:shadow-[var(--shadow-elevated)] transition-all duration-300 hover:-translate-y-1 overflow-hidden relative"
                onClick={() => navigate(service.route)}
              >
                {/* Hover gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className={`p-2.5 md:p-3 rounded-xl ${service.iconBg} transition-transform group-hover:scale-110 duration-300`}>
                      <Icon className={`h-5 w-5 md:h-6 md:w-6 ${service.iconColor}`} />
                    </div>
                    {service.tag && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r ${service.gradient} text-white`}>
                        {service.tag}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base md:text-lg font-bold text-foreground mb-0.5 group-hover:text-primary transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {service.description}
                  </p>

                  <div className="mt-3 md:mt-4 flex items-center text-primary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                    Explore
                    <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ServiceHubPage.displayName = "ServiceHubPage";

export default ServiceHubPage;
