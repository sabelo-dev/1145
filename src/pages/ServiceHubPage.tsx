import React from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Car, Package, Wallet, Briefcase, ArrowRight, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const services = [
  {
    id: "commerce",
    name: "Shop",
    description: "Browse and buy products from local merchants",
    icon: ShoppingBag,
    color: "from-blue-600 to-indigo-700",
    textColor: "text-blue-600",
    bgColor: "bg-blue-50",
    route: "/shop",
  },
  {
    id: "rides",
    name: "Travel",
    description: "Request a ride to your destination",
    icon: Car,
    color: "from-purple-600 to-violet-700",
    textColor: "text-purple-600",
    bgColor: "bg-purple-50",
    route: "/rides",
  },
  {
    id: "delivery",
    name: "Drive",
    description: "Send and receive packages across the city",
    icon: Package,
    color: "from-pink-500 to-rose-600",
    textColor: "text-pink-600",
    bgColor: "bg-pink-50",
    route: "/driver/dashboard",
  },
  {
    id: "wallet",
    name: "Transact",
    description: "Manage your money, payments, and transfers",
    icon: Wallet,
    color: "from-amber-500 to-orange-600",
    textColor: "text-amber-600",
    bgColor: "bg-amber-50",
    route: "/wallet",
  },
  {
    id: "lease",
    name: "Lease",
    description: "Lease electronics, vehicles, and equipment with flexible terms",
    icon: KeyRound,
    color: "from-teal-500 to-cyan-600",
    textColor: "text-teal-600",
    bgColor: "bg-teal-50",
    route: "/shop?listing_type=lease",
  },
  {
    id: "business",
    name: "Business",
    description: "Tools for merchants and service providers",
    icon: Briefcase,
    color: "from-emerald-500 to-green-600",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
    route: "/merchant/dashboard",
  },
];

const ServiceHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#3A0CA3] to-[#4361EE] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.svg" alt="1145" className="h-12 w-12 rounded-xl" />
            <span className="text-2xl font-bold tracking-tight">1145</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-3 tracking-tight">
            Your Super App
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-xl">
            Shop, Travel, Transact — everything you need in one place.
          </p>
          {user && (
            <p className="mt-4 text-white/60 text-sm">
              Hi there, {user.name || user.email}
            </p>
          )}
        </div>
      </div>

      {/* Services Grid */}
      <div className="container mx-auto px-4 -mt-8 relative z-20 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card
                key={service.id}
                className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                onClick={() => navigate(service.route)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${service.bgColor}`}>
                      <Icon className={`h-7 w-7 ${service.textColor}`} />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 duration-300" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-1">
                    {service.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ServiceHubPage;
