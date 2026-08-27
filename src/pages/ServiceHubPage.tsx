import React from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Car, Package, Wallet, Briefcase, ArrowRight, KeyRound, TrendingUp, Shield, Zap, Megaphone, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    gradient: "from-gold/10 to-orange-500",
    iconBg: "bg-gold/10",
    iconColor: "text-gold",
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
    route: "/merchant/dashboard?tab=leasing",
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
  {
    id: "influence",
    name: "Influence",
    description: "Grow your brand and monetize your audience",
    icon: Megaphone,
    gradient: "from-pink-500 to-fuchsia-600",
    iconBg: "bg-pink-500/10",
    iconColor: "text-pink-500",
    route: "/influencer/login",
    tag: "Create",
  },
  {
    id: "stays",
    name: "Stay",
    description: "Book hotels, lodges, and vacation rentals",
    icon: Building2,
    gradient: "from-sky-500 to-cyan-500",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-500",
    route: "/stays",
    tag: "New",
  },
  {
    id: "courier",
    name: "Courier",
    description: "Send Packages",
    icon: Package,
    gradient: "from-sky-500 to-cyan-500",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-500",
    route: "/courier",
    tag: "New",
  },
];

const highlights = [
  { icon: Shield, label: "Secure Payments", desc: "End-to-end encrypted" },
  { icon: Zap, label: "Fast Delivery", desc: "Same-day available" },
  { icon: TrendingUp, label: "Best Prices", desc: "Gold-backed pricing" },
];

const ServiceHubPage = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();

  return (
    <div ref={ref} className="min-h-screen bg-background pt-4">
      {/* Highlights Bar */}
      <div className="container mx-auto px-4 mb-6">
        <div className="glass rounded-2xl p-4 md:p-5 shadow-lg">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {highlights.map((h) => (
              <div key={h.label} className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 justify-center text-center sm:text-left">

                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <h.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] sm:text-xs font-semibold text-foreground">{h.label}</p>
                  <p className="text-[11px] sm:text-[11px] text-muted-foreground hidden sm:block">{h.desc}</p>
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
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r ${service.gradient} text-white`}>
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
