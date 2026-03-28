import React, { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Check } from "lucide-react";

interface StorefrontNewsletterProps {
  title?: string;
  accentColor: string;
  storeName: string;
}

const StorefrontNewsletter: React.FC<StorefrontNewsletterProps> = ({
  title,
  accentColor,
  storeName,
}) => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (email) setSubmitted(true);
  };

  return (
    <section
      className="py-14 md:py-20 px-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}06)`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative max-w-md mx-auto text-center"
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <Mail className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          {title || "Stay in the Loop"}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Get exclusive deals and new arrivals from {storeName}
        </p>

        {submitted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center justify-center gap-2 py-3 text-sm font-medium"
            style={{ color: accentColor }}
          >
            <Check className="h-4 w-4" />
            You're subscribed!
          </motion.div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              type="email"
              className="rounded-full"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <Button
              onClick={handleSubmit}
              className="rounded-full px-5 text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default StorefrontNewsletter;
