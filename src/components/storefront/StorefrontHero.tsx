import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Play, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

interface StorefrontHeroProps {
  storeName: string;
  description?: string;
  bannerUrl?: string;
  videoUrl?: string;
  logoUrl?: string;
  accentColor: string;
  ctaText: string;
  ctaUrl?: string;
  tagline?: string;
  hasVideo: boolean;
}

const StorefrontHero: React.FC<StorefrontHeroProps> = ({
  storeName,
  description,
  bannerUrl,
  videoUrl,
  logoUrl,
  accentColor,
  ctaText,
  ctaUrl,
  tagline,
  hasVideo,
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const parallaxOffset = scrollY * 0.3;

  const isVideoUrl = (url: string) =>
    url.match(/\.(mp4|webm|ogg)(\?|$)/i) || url.includes("supabase.co/storage");

  const hasMedia = videoUrl || bannerUrl;

  if (!hasMedia) {
    // Gradient hero fallback
    return (
      <div
        className="relative w-full min-h-[50vh] md:min-h-[60vh] flex items-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor}dd 0%, ${accentColor}88 50%, ${accentColor}44 100%)`,
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full opacity-20 bg-white/10 blur-3xl" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] rounded-full opacity-15 bg-white/10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            {logoUrl && (
              <motion.img
                src={logoUrl}
                alt={storeName}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-2xl mb-6 ring-4 ring-white/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              />
            )}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              {storeName}
            </h1>
            {(tagline || description) && (
              <p className="text-base md:text-lg text-white/80 mb-8 max-w-lg leading-relaxed">
                {tagline || description}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                className="rounded-full px-8 font-semibold shadow-xl hover:shadow-2xl transition-all hover:scale-105 bg-white text-foreground hover:bg-white/90"
                onClick={() => {
                  const el = document.getElementById("products");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {ctaText}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              {ctaUrl && (
                <Link to={ctaUrl}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-6 border-white/30 text-white hover:bg-white/10"
                  >
                    Learn More
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[55vh] md:h-[70vh] lg:h-[80vh] overflow-hidden">
      {/* Media layer with parallax */}
      <div
        className="absolute inset-0 w-full h-[120%]"
        style={{ transform: `translateY(-${parallaxOffset}px)` }}
      >
        {videoUrl && hasVideo && isVideoUrl(videoUrl) ? (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            loop
            playsInline
          />
        ) : videoUrl && hasVideo ? (
          <iframe
            src={videoUrl}
            className="w-full h-full"
            frameBorder="0"
            allowFullScreen
            title="Store video"
          />
        ) : (
          <img
            src={bannerUrl}
            alt={`${storeName} banner`}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-end">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            {logoUrl && (
              <motion.img
                src={logoUrl}
                alt={storeName}
                className="w-14 h-14 md:w-18 md:h-18 rounded-2xl object-cover shadow-2xl mb-5 ring-4 ring-white/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              />
            )}
            <motion.h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3 tracking-tight drop-shadow-lg"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              {storeName}
            </motion.h1>
            {(tagline || description) && (
              <motion.p
                className="text-sm md:text-lg text-white/80 mb-6 max-w-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {tagline || description}
              </motion.p>
            )}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                size="lg"
                className="rounded-full px-8 font-semibold shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-white"
                style={{ backgroundColor: accentColor }}
                onClick={() => {
                  const el = document.getElementById("products");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {ctaText}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Video controls */}
      {videoUrl && hasVideo && isVideoUrl(videoUrl) && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-4 right-4 z-20 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};

export default StorefrontHero;
