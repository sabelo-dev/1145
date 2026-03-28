import React from "react";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Heart, Target, Sparkles } from "lucide-react";

interface StorefrontBrandStoryProps {
  storeName: string;
  aboutUs: string;
  accentColor: string;
  logoUrl?: string;
  joinedDate?: string;
}

const StorefrontBrandStory: React.FC<StorefrontBrandStoryProps> = ({
  storeName,
  aboutUs,
  accentColor,
  logoUrl,
  joinedDate,
}) => {
  if (!aboutUs) return null;

  // Split about text into paragraphs for better layout
  const paragraphs = aboutUs.split("\n").filter((p) => p.trim());

  return (
    <section className="py-16 md:py-24 px-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(${accentColor} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 text-white"
            style={{ backgroundColor: accentColor }}
          >
            <Sparkles className="h-3 w-3" />
            Our Story
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            The {storeName} Story
          </h2>
          <Separator
            className="w-16 mx-auto"
            style={{ backgroundColor: accentColor }}
          />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Visual side */}
          <motion.div
            className="md:col-span-5"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              {logoUrl ? (
                <div className="relative">
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="w-full max-w-[280px] mx-auto rounded-2xl shadow-2xl"
                  />
                  <div
                    className="absolute -bottom-3 -right-3 w-full h-full rounded-2xl -z-10 opacity-20"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              ) : (
                <div
                  className="w-full aspect-square max-w-[280px] mx-auto rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                  }}
                >
                  <span className="text-6xl font-bold opacity-30" style={{ color: accentColor }}>
                    {storeName.charAt(0)}
                  </span>
                </div>
              )}

              {/* Stats badges */}
              <div className="flex justify-center gap-4 mt-6">
                {[
                  { icon: Heart, label: "Passion" },
                  { icon: Target, label: "Quality" },
                  { icon: Sparkles, label: "Innovation" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-muted/50"
                  >
                    <item.icon className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Text side */}
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="space-y-4">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={`leading-relaxed ${
                    i === 0
                      ? "text-base md:text-lg text-foreground font-medium"
                      : "text-sm md:text-base text-muted-foreground"
                  }`}
                >
                  {p}
                </p>
              ))}
            </div>
            {joinedDate && (
              <p className="text-xs text-muted-foreground mt-6 italic">
                Established {joinedDate}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default StorefrontBrandStory;
