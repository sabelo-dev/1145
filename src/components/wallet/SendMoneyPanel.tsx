import { useState } from 'react';
import { Send, User, Coins, Wallet, AlertTriangle, ArrowRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { motion } from 'framer-motion';

interface SendMoneyPanelProps {
  zarBalance: number;
  ucoinBalance: number;
  walletAddress: string;
  isTransferring: boolean;
  onSendZar: (to: string, amount: number, note?: string) => Promise<void>;
  onSendUcoin: (to: string, amount: number, note?: string) => Promise<any>;
}

export function SendMoneyPanel({
  zarBalance, ucoinBalance, walletAddress, isTransferring, onSendZar, onSendUcoin
}: SendMoneyPanelProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { mgGoldToCurrency, displayCurrency, getCurrency } = useGoldPricingContext();

  const currency = getCurrency(displayCurrency);
  const currencySymbol = currency?.currencySymbol || 'R';
  const amountNum = parseFloat(amount) || 0;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendZar = async () => {
    setError('');
    if (!recipient.trim()) return setError('Enter a recipient wallet ID');
    if (amountNum <= 0) return setError('Enter a valid amount');
    if (amountNum > zarBalance) return setError('Insufficient ZAR balance');
    try {
      await onSendZar(recipient, amountNum, note || undefined);
      setRecipient(''); setAmount(''); setNote('');
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
    }
  };

  const handleSendUcoin = async () => {
    setError('');
    if (!recipient.trim()) return setError('Enter a recipient wallet ID');
    if (amountNum <= 0) return setError('Enter a valid amount');
    if (amountNum > ucoinBalance) return setError('Insufficient UCoin balance');
    try {
      const result = await onSendUcoin(recipient, amountNum, note || undefined);
      if (result?.success) {
        setRecipient(''); setAmount(''); setNote('');
      } else {
        setError(result?.error || 'Transfer failed');
      }
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Money
          </CardTitle>
          <CardDescription>Transfer ZAR or UCoin to anyone on the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Your Wallet Address */}
          <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Your Wallet</p>
              <p className="text-xs font-mono truncate mt-0.5">
                {walletAddress ? `${walletAddress.slice(0, 12)}...${walletAddress.slice(-6)}` : '—'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={copyAddress}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <Tabs defaultValue="zar">
            <TabsList className="w-full grid grid-cols-2 h-9">
              <TabsTrigger value="zar" className="text-xs gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Cash (ZAR)
              </TabsTrigger>
              <TabsTrigger value="ucoin" className="text-xs gap-1.5">
                <Coins className="h-3.5 w-3.5" /> UCoin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="zar" className="space-y-3 mt-3">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Recipient</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Wallet address or user ID"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    className="pl-10 h-10"
                    disabled={isTransferring}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="h-10 text-lg font-semibold"
                  disabled={isTransferring}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Available: {currencySymbol}{zarBalance.toFixed(2)}
                </p>
              </div>

              <Textarea
                placeholder="Add a note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                disabled={isTransferring}
              />

              <Button
                className="w-full gap-2"
                onClick={handleSendZar}
                disabled={isTransferring || amountNum <= 0}
              >
                {isTransferring ? 'Sending...' : 'Send'} <ArrowRight className="h-4 w-4" />
              </Button>
            </TabsContent>

            <TabsContent value="ucoin" className="space-y-3 mt-3">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Recipient</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Wallet address or user ID"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    className="pl-10 h-10"
                    disabled={isTransferring}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (UCoin)</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-10 h-10 text-lg font-semibold"
                    disabled={isTransferring}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Available: {ucoinBalance.toLocaleString()} UCoin
                  {amountNum > 0 && ` • ≈ ${currencySymbol}${mgGoldToCurrency(amountNum, displayCurrency).toFixed(2)}`}
                </p>
              </div>

              <Textarea
                placeholder="Add a note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                disabled={isTransferring}
              />

              <Button
                className="w-full gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
                onClick={handleSendUcoin}
                disabled={isTransferring || amountNum <= 0}
              >
                {isTransferring ? 'Sending...' : 'Send UCoin'} <ArrowRight className="h-4 w-4" />
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
