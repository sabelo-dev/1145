import { Scale, TrendingUp } from 'lucide-react';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { motion } from 'framer-motion';

export function GoldPriceTicker() {
  const { goldPrice } = useGoldPricingContext();

  if (!goldPrice) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex items-center justify-between bg-card border rounded-xl px-4 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium">Gold Spot</p>
          <p className="text-sm font-bold">${goldPrice.pricePerOzUsd.toFixed(2)}<span className="text-xs text-muted-foreground font-normal">/oz</span></p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-muted-foreground font-medium">Per gram</p>
        <p className="text-sm font-semibold">${goldPrice.pricePerGramUsd.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
        <TrendingUp className="h-3 w-3" />
        <span>Live</span>
      </div>
    </motion.div>
  );
}
