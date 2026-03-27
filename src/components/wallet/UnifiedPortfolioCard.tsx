import { useState } from 'react';
import { Eye, EyeOff, Wallet, Scale, Coins, TrendingUp, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { motion } from 'framer-motion';

interface UnifiedPortfolioCardProps {
  zarBalance: number;
  goldBalanceMg: number;
  ucoinBalance: number;
  pendingZar: number;
  lifetimeEarned: number;
}

export function UnifiedPortfolioCard({
  zarBalance, goldBalanceMg, ucoinBalance, pendingZar, lifetimeEarned
}: UnifiedPortfolioCardProps) {
  const [showBalance, setShowBalance] = useState(true);
  const { mgGoldToCurrency, formatGold, displayCurrency, getCurrency } = useGoldPricingContext();

  const currency = getCurrency(displayCurrency);
  const currencySymbol = currency?.currencySymbol || 'R';
  const goldValueZar = mgGoldToCurrency(goldBalanceMg, displayCurrency);
  const ucoinValueZar = mgGoldToCurrency(ucoinBalance, displayCurrency);
  const totalPortfolio = zarBalance + goldValueZar + ucoinValueZar;

  const assets = [
    {
      label: 'Cash',
      sublabel: 'ZAR',
      value: zarBalance,
      display: `${currencySymbol}${zarBalance.toFixed(2)}`,
      icon: Wallet,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
      percent: totalPortfolio > 0 ? (zarBalance / totalPortfolio) * 100 : 0,
    },
    {
      label: 'Gold Vault',
      sublabel: formatGold(goldBalanceMg),
      value: goldValueZar,
      display: `${currencySymbol}${goldValueZar.toFixed(2)}`,
      icon: Scale,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      percent: totalPortfolio > 0 ? (goldValueZar / totalPortfolio) * 100 : 0,
    },
    {
      label: 'UCoin',
      sublabel: `${ucoinBalance.toLocaleString()} UC`,
      value: ucoinValueZar,
      display: `${currencySymbol}${ucoinValueZar.toFixed(2)}`,
      icon: Coins,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      percent: totalPortfolio > 0 ? (ucoinValueZar / totalPortfolio) * 100 : 0,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-0 shadow-xl">
        {/* Main Balance Section */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 pb-4 text-white">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Total Portfolio
                </span>
              </div>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                {showBalance ? (
                  <Eye className="h-4 w-4 text-white/50" />
                ) : (
                  <EyeOff className="h-4 w-4 text-white/50" />
                )}
              </button>
            </div>

            <motion.p
              key={showBalance ? 'show' : 'hide'}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-1"
            >
              {showBalance
                ? `${currencySymbol}${totalPortfolio.toFixed(2)}`
                : `${currencySymbol}••••••`}
            </motion.p>

            {pendingZar > 0 && showBalance && (
              <p className="text-xs text-white/40">
                + {currencySymbol}{pendingZar.toFixed(2)} pending
              </p>
            )}

            {/* Portfolio allocation bar */}
            {totalPortfolio > 0 && (
              <div className="flex h-1.5 rounded-full overflow-hidden mt-4 bg-white/10">
                {assets.map((asset, i) => (
                  <motion.div
                    key={asset.label}
                    initial={{ width: 0 }}
                    animate={{ width: `${asset.percent}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                    className={`${i === 0 ? 'bg-sky-400' : i === 1 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Asset Breakdown */}
        <div className="grid grid-cols-3 divide-x divide-border bg-card">
          {assets.map((asset, i) => {
            const Icon = asset.icon;
            return (
              <motion.div
                key={asset.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="p-4 text-center"
              >
                <div className={`inline-flex p-2 rounded-full ${asset.bg} mb-2`}>
                  <Icon className={`h-4 w-4 ${asset.color}`} />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{asset.label}</p>
                <p className="text-sm font-bold mt-0.5">
                  {showBalance ? asset.display : '•••'}
                </p>
                {showBalance && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{asset.sublabel}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
