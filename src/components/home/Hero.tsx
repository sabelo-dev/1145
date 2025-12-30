import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ShoppingBag } from "lucide-react";

const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 min-h-[30vh] flex items-center">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-1.2.1&auto=format&fit=crop&w=2000&q=80"
          alt="Shopping lifestyle"
          className="w-full h-full object-cover object-center opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/85"></div>
      </div>

      <div className="wwe-container relative z-10">
        <div className="flex flex-col items-center justify-center text-center py-8 md:py-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 mb-4 animate-fade-in">
            <Sparkles className="h-3 w-3 text-yellow-300" />
            <span className="text-xs text-white font-medium">Coming Soon</span>
          </div>

          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-3 animate-fade-in">
            Welcome to <span className="text-yellow-300">1145 Lifestyle</span>
          </h1>

          <p className="text-base md:text-lg text-white/90 mb-2 animate-fade-in">
            The future of shopping, reimagined.
          </p>

          <p className="text-sm md:text-base text-white/80 mb-6 max-w-xl animate-fade-in">
            Discover a world where fashion, beauty, gadgets, and home essentials meet effortless style.
          </p>

          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <Link to="/register">
              <Button 
                size="default" 
                className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 font-bold px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Register Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
