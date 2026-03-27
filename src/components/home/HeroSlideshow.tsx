import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag, Car, Wallet, KeyRound } from "lucide-react";

const slides = [
  {
    title: "Shop Local",
    subtitle: "Discover products from trusted merchants near you",
    icon: ShoppingBag,
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    accent: "from-blue-400/30 to-indigo-500/30",
  },
  {
    title: "Ride Anywhere",
    subtitle: "Fast, reliable rides at your fingertips",
    icon: Car,
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    accent: "from-violet-400/30 to-purple-500/30",
  },
  {
    title: "Gold-Backed Wallet",
    subtitle: "Your money, secured by real value",
    icon: Wallet,
    image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80",
    accent: "from-amber-400/30 to-orange-500/30",
  },
  {
    title: "Lease Smart",
    subtitle: "Electronics, vehicles & equipment on flexible terms",
    icon: KeyRound,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80",
    accent: "from-teal-400/30 to-cyan-500/30",
  },
];

const HeroSlideshow: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="relative hidden md:block">
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Background image */}
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.image}
            alt={s.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t ${slide.accent} transition-all duration-500`} />
        <div className="absolute inset-0 bg-black/40" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{slide.title}</h3>
          </div>
          <p className="text-sm text-white/80">{slide.subtitle}</p>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSlideshow;
