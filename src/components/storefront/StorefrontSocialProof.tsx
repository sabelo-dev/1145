import React from "react";
import { motion } from "framer-motion";
import { Star, Users, ShoppingBag, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Testimonial } from "@/types/storefront";

interface StorefrontSocialProofProps {
  testimonials: Testimonial[];
  avgRating: number;
  totalProducts: number;
  accentColor: string;
}

const StorefrontSocialProof: React.FC<StorefrontSocialProofProps> = ({
  testimonials,
  avgRating,
  totalProducts,
  accentColor,
}) => {
  return (
    <section className="py-12 md:py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            Loved by Customers
          </h2>
          <p className="text-sm text-muted-foreground">
            See what people are saying
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-3 md:gap-6 mb-10"
        >
          {[
            {
              icon: Star,
              value: avgRating > 0 ? avgRating.toFixed(1) : "New",
              label: "Store Rating",
            },
            {
              icon: ShoppingBag,
              value: totalProducts.toString(),
              label: "Products",
            },
            {
              icon: TrendingUp,
              value: testimonials.length > 0 ? `${testimonials.length}+` : "Growing",
              label: "Reviews",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 md:p-6 rounded-2xl bg-muted/30 border border-border/50"
            >
              <stat.icon
                className="h-5 w-5 mx-auto mb-2"
                style={{ color: accentColor }}
              />
              <div className="text-xl md:text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-all h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= t.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 italic">
                      "{t.text}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: accentColor }}
                      >
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {t.name}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default StorefrontSocialProof;
