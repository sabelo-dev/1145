import { useState } from 'react';
import { ArrowRightLeft, TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGoldTrading, GoldQuote } from '@/hooks/useGoldTrading';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';

interface GoldTradingPanelProps {
  zarBalance: number;
  goldBalanceMg: number;
  onTradeComplete: () => void;
}

export function GoldTradingPanel({ zarBalance, goldBalanceMg, onTradeComplete }: GoldTradingPanelProps) {
  const { isTrading, getBuyQuote, getSellQuote, buyGold, sellGold } = useGoldTrading();
  const { formatGold, formatCurrencyAmount, displayCurrency } = useGoldPricingContext();
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');

  const buyQuote = getBuyQuote(parseFloat(buyAmount) || 0);
  const sellQuote = getSellQuote(parseFloat(sellAmount) || 0);

  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    const result = await buyGold(amount);
    if (result.success) {
      setBuyAmount('');
      onTradeComplete();
    }
  };

  const handleSell = async () => {
    const mg = parseFloat(sellAmount);
    if (!mg || mg <= 0) return;
    const result = await sellGold(mg);
    if (result.success) {
      setSellAmount('');
      onTradeComplete();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRightLeft className="h-5 w-5 text-amber-500" />
          Gold Trading
        </CardTitle>
        <CardDescription>Buy and sell gold using your ZAR balance</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Buy Gold
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              Sell Gold
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Amount (ZAR)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={buyAmount}
                onChange={e => setBuyAmount(e.target.value)}
                min="1"
                max={zarBalance}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatCurrencyAmount(zarBalance, displayCurrency)}
              </p>
            </div>

            {buyQuote && buyQuote.goldMg > 0 && (
              <QuoteSummary quote={buyQuote} type="buy" formatGold={formatGold} />
            )}

            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
              onClick={handleBuy}
              disabled={isTrading || !buyQuote || buyQuote.goldMg <= 0 || (parseFloat(buyAmount) || 0) > zarBalance}
            >
              {isTrading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isTrading ? 'Processing...' : 'Buy Gold'}
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Gold to sell (mg)</label>
              <Input
                type="number"
                placeholder="0"
                value={sellAmount}
                onChange={e => setSellAmount(e.target.value)}
                min="1"
                max={goldBalanceMg}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatGold(goldBalanceMg)}
              </p>
            </div>

            {sellQuote && sellQuote.fiatAmount > 0 && (
              <QuoteSummary quote={sellQuote} type="sell" formatGold={formatGold} />
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={handleSell}
              disabled={isTrading || !sellQuote || sellQuote.fiatAmount <= 0 || (parseFloat(sellAmount) || 0) > goldBalanceMg}
            >
              {isTrading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isTrading ? 'Processing...' : 'Sell Gold'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function QuoteSummary({ quote, type, formatGold }: { quote: GoldQuote; type: 'buy' | 'sell'; formatGold: (mg: number) => string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
        <Info className="h-3.5 w-3.5" />
        <span className="font-medium">Trade Quote</span>
      </div>
      {type === 'buy' ? (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You pay</span>
            <span className="font-medium">R{quote.fiatAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You receive</span>
            <span className="font-semibold text-amber-600">{formatGold(quote.goldMg)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You sell</span>
            <span className="font-medium">{formatGold(quote.goldMg)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You receive</span>
            <span className="font-semibold text-emerald-600">R{quote.fiatAmount.toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
        <span>Spread ({quote.spreadPercent}%)</span>
        <span>R{quote.spreadAmount.toFixed(2)}</span>
      </div>
    </div>
  );
}
