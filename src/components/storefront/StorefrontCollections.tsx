import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Product } from "@/types";

interface StorefrontCollectionsProps {
  categories: string[];
  products: Product[];
  accentColor: string;
  onCategoryClick: (category: string | null) => void;
}

const StorefrontCollections: React.FC<StorefrontCollectionsProps> = ({
  categories,
  products,
  accentColor,
  onCategoryClick,
}) => {
  if (categories.length < 2) return null;

  const collectionData = categories.slice(0, 6).map((cat) => {
    const catProducts = products.filter((p) => p.category === cat);
    const image = catProducts[0]?.images?.[0];
    return { name: cat, count: catProducts.length, image };
  });

  return (
    <section id="collections" className="py-12 md:py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            Shop by Collection
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore our curated selections
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {collectionData.map((col, i) => (
            <motion.button
              key={col.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              onClick={() => {
                onCategoryClick(col.name);
                const el = document.getElementById("products");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer text-left"
            >
              {col.image ? (
                <img
                  src={col.image}
                  alt={col.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}66)`,
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <h3 className="text-white font-bold text-sm md:text-lg mb-0.5">
                  {col.name}
                </h3>
                <div className="flex items-center gap-1 text-white/70 text-xs md:text-sm">
                  <span>{col.count} items</span>
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StorefrontCollections;
