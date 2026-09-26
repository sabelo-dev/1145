import React, { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Check, AlertCircle, Loader2 } from "lucide-react";
import { subscribeToNewsletter } from "@/services/newsletterService";
import { toast } from "sonner";

interface StorefrontNewsletterProps {
  title?: string;
  accentColor: string;
  storeName: string;
  storeId?: string;
}

const StorefrontNewsletter: React.FC<StorefrontNewsletterProps> = ({
  title,
  accentColor,
  storeName,
  storeId,
}) => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (emailStr: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate email format
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    if (!storeId) {
      setError("Store ID is missing");
      return;
    }

    setIsLoading(true);

    try {
      await subscribeToNewsletter(email, storeId);

      toast.success("Successfully subscribed to our newsletter!");
      setSubmitted(true);
      setEmail("");
      setError(null);
    } catch (err) {
      console.error("Newsletter subscription error:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
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
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your email"
                type="email"
                className="rounded-full"
                disabled={isLoading}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
              />
              <Button
                onClick={handleSubmit}
                className="rounded-full px-5 text-white"
                style={{ backgroundColor: accentColor }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-lg"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default StorefrontNewsletter;

