import { useState } from 'react';
import { Send, AlertTriangle, Info, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { UCoinTransferLimits, UCoinWallet } from '@/types/ucoin';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';

interface UCoinTransferFormProps {
  wallet: UCoinWallet | null;
  limits: UCoinTransferLimits | null;
  isTransferring: boolean;
  onTransfer: (recipientId: string, amount: number, note?: string) => Promise<any>;
}

export function UCoinTransferForm({ wallet, limits, isTransferring, onTransfer }: UCoinTransferFormProps) {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  
  const { mgGoldToCurrency, displayCurrency } = useGoldPricingContext();

  const amountNum = parseFloat(amount) || 0;
  const balance = wallet?.balance || 0;

  // Calculate currency value (1 UCoin = 1 mg gold)
  const currencyValue = mgGoldToCurrency(amountNum, displayCurrency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recipientId.trim()) {
      setError('Please enter a recipient ID');
      return;
    }

    if (amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum > balance) {
      setError('Insufficient balance');
      return;
    }

    if (limits && amountNum < limits.min_transfer_mg) {
      setError(`Minimum transfer is ${limits.min_transfer_mg} UCoin`);
      return;
    }

    if (limits && amountNum > limits.single_transfer_max_mg) {
      setError(`Maximum transfer is ${limits.single_transfer_max_mg} UCoin`);
      return;
    }

    const result = await onTransfer(recipientId, amountNum, note || undefined);
    
    if (result.success) {
      setRecipientId('');
      setAmount('');
      setNote('');
    } else {
      setError(result.error || 'Transfer failed');
    }
  };

  const dailyUsagePercent = limits 
    ? (limits.daily_used_mg / limits.daily_limit_mg) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send UCoin
        </CardTitle>
        <CardDescription>
          Transfer UCoin to another user. 1 UCoin = 1 mg of gold (mgAu)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient User ID</Label>
            <Input
              id="recipient"
              placeholder="Enter recipient's user ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              disabled={isTransferring}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (UCoin)</Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                min="1"
                max={limits?.single_transfer_max_mg || balance}
                disabled={isTransferring}
              />
            </div>
            {amountNum > 0 && (
              <p className="text-sm text-muted-foreground">
                = {amountNum.toLocaleString()} mg Au ≈ {displayCurrency} {currencyValue.toFixed(2)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a message for the recipient"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              disabled={isTransferring}
            />
          </div>

          {limits && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Daily Limit Usage</span>
              </div>
              <Progress value={dailyUsagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {limits.daily_used_mg.toLocaleString()} / {limits.daily_limit_mg.toLocaleString()} UCoin used today
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Available: <span className="font-semibold text-foreground">{balance.toLocaleString()} UCoin</span>
            </p>
            <Button type="submit" disabled={isTransferring || amountNum <= 0}>
              {isTransferring ? 'Sending...' : 'Send UCoin'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
