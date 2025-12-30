import React from "react";
import { Link } from "react-router-dom";
import { Tag, Clock, ArrowRight, Zap, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

const PromoBanner: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-primary to-primary/80 py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Main Promo */}
          <div className="flex items-center gap-3 text-primary-foreground">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Flash Sale</span>
            </div>
            <p className="text-sm md:text-base font-medium">
              Up to <span className="font-bold text-yellow-300">50% OFF</span> on selected items!
            </p>
          </div>

          {/* Timer & CTA */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-primary-foreground/90 text-sm">
              <Clock className="h-4 w-4" />
              <span>Ends in 24:00:00</span>
            </div>
            <Link to="/deals">
              <Button 
                size="sm" 
                variant="secondary"
                className="bg-white text-primary hover:bg-white/90 font-semibold"
              >
                Shop Now
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Secondary promos - visible on larger screens */}
        <div className="hidden lg:flex items-center justify-center gap-8 mt-2 pt-2 border-t border-white/20">
          <div className="flex items-center gap-2 text-primary-foreground/80 text-xs">
            <Tag className="h-3 w-3" />
            <span>Free shipping on orders over R500</span>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/80 text-xs">
            <Gift className="h-3 w-3" />
            <span>New customer? Get 10% off your first order</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
