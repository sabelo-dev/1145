import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ShoppingBag, ArrowRight } from "lucide-react";
import { Product } from "@/types";
import { useCart } from "@/contexts/CartContext";

interface StorefrontProductSpotlightProps {
  products: Product[];
  accentColor: string;
  storeName: string;
}

const StorefrontProductSpotlight: React.FC<StorefrontProductSpotlightProps> = ({
  products,
  accentColor,
  storeName,
}) => {
  const { addItem } = useCart();
  if (products.length === 0) return null;

  const hero = products[0];
  const supporting = products.slice(1, 4);

  return (
    <section className="py-12 md:py-20 px-4" style={{ backgroundColor: `${accentColor}06` }}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            Signature Products
          </h2>
          <p className="text-sm text-muted-foreground">
            Our most loved items, hand-picked by {storeName}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
          {/* Hero product */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={hero.image_url || hero.images?.[0]}
                alt={hero.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="p-5 md:p-6">
              {hero.compare_at_price && hero.compare_at_price > hero.price && (
                <Badge variant="destructive" className="mb-2 rounded-full text-xs">
                  {Math.round(((hero.compare_at_price - hero.price) / hero.compare_at_price) * 100)}% OFF
                </Badge>
              )}
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
                {hero.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {hero.description}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{hero.rating.toFixed(1)}</span>
                </div>
                <span className="text-muted-foreground">·</span>
                <span className="text-lg font-bold" style={{ color: accentColor }}>
                  R{hero.price.toFixed(2)}
                </span>
                {hero.compare_at_price && hero.compare_at_price > hero.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    R{hero.compare_at_price.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  className="rounded-full flex-1 text-white"
                  style={{ backgroundColor: accentColor }}
                  onClick={() => addItem(hero)}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
                <Link to={`/product/${hero.id}`}>
                  <Button variant="outline" className="rounded-full">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Supporting products */}
          <div className="flex flex-col gap-4">
            {supporting.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group flex gap-4 rounded-xl overflow-hidden bg-card border border-border/50 shadow-sm p-3 hover:shadow-md transition-shadow"
              >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={product.image_url || product.images?.[0]}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <h4 className="font-semibold text-foreground text-sm md:text-base truncate">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">
                      {product.rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-bold text-sm" style={{ color: accentColor }}>
                      R{product.price.toFixed(2)}
                    </span>
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        R{product.compare_at_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      className="rounded-full text-xs h-8 text-white"
                      style={{ backgroundColor: accentColor }}
                      onClick={() => addItem(product)}
                    >
                      Add to Cart
                    </Button>
                    <Link to={`/product/${product.id}`}>
                      <Button size="sm" variant="ghost" className="rounded-full text-xs h-8">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StorefrontProductSpotlight;
