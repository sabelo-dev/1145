import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, Shield, Truck } from "lucide-react";

const HomeHero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="wwe-container relative py-8 md:py-12">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">
            Discover Quality Products from
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"> Trusted Vendors</span>
          </h1>
          
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Shop the latest trends in electronics, fashion, home goods, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
            <Link to="/shop">
              <Button size="default" className="w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" />
                Browse Products
              </Button>
            </Link>
            <Link to="/categories">
              <Button size="default" variant="outline" className="w-full sm:w-auto">
                View Categories
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
