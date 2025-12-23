import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, Shield, Truck } from "lucide-react";

const HomeHero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="wwe-container relative py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            Discover Quality Products from
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Trusted Vendors</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Shop the latest trends in electronics, fashion, home goods, and more. Fast shipping, secure checkout, and exceptional customer service.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/shop">
              <Button size="lg" className="w-full sm:w-auto">
                <Search className="mr-2 h-5 w-5" />
                Browse Products
              </Button>
            </Link>
            <Link to="/categories">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Categories
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <div className="flex flex-col items-center space-y-2 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Best Deals</h3>
              <p className="text-sm text-muted-foreground text-center">Competitive prices on quality products</p>
            </div>

            <div className="flex flex-col items-center space-y-2 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Secure Shopping</h3>
              <p className="text-sm text-muted-foreground text-center">Safe and encrypted transactions</p>
            </div>

            <div className="flex flex-col items-center space-y-2 p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Fast Delivery</h3>
              <p className="text-sm text-muted-foreground text-center">Quick shipping across South Africa</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
