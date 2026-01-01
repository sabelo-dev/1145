import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wallet,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import type { DriverCashout as DriverCashoutType, DriverTier } from '@/types/driver';

interface DriverCashoutProps {
  cashouts: DriverCashoutType[];
  availableBalance: number;
  currentTier: DriverTier | null;
  onRequestCashout: (amount: number, paymentMethod: string) => Promise<boolean>;
}

const DriverCashout: React.FC<DriverCashoutProps> = ({
  cashouts,
  availableBalance,
  currentTier,
  onRequestCashout,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [loading, setLoading] = useState(false);

  const feePercent = currentTier?.cashout_fee_percent || 5;
  const feeAmount = parseFloat(amount || '0') * (feePercent / 100);
  const netAmount = parseFloat(amount || '0') - feeAmount;

  const handleCashout = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const success = await onRequestCashout(parseFloat(amount), paymentMethod);
    setLoading(false);
    if (success) {
      setDialogOpen(false);
      setAmount('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-500 text-white">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const totalCashedOut = cashouts
    .filter((c) => c.status === 'completed')
    .reduce((sum, c) => sum + c.net_amount, 0);

  const pendingCashouts = cashouts.filter((c) => c.status === 'pending' || c.status === 'processing');

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-full bg-primary/20">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available for Cashout</p>
                <p className="text-3xl font-bold">R{availableBalance.toFixed(2)}</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" disabled={availableBalance <= 0}>
                  <ArrowDownToLine className="h-5 w-5 mr-2" />
                  Cash Out
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Cashout</DialogTitle>
                  <DialogDescription>
                    Withdraw your earnings to your preferred payment method
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Amount (R)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={availableBalance}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: R{availableBalance.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="instant">Instant (Higher Fee)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {parseFloat(amount || '0') > 0 && (
                    <div className="p-4 rounded-lg bg-muted space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Amount</span>
                        <span>R{parseFloat(amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Fee ({feePercent}%)</span>
                        <span>-R{feeAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>You'll Receive</span>
                        <span className="text-primary">R{netAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {currentTier && currentTier.cashout_fee_percent < 5 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
                      <Info className="h-4 w-4" />
                      <span className="text-sm">
                        Your {currentTier.display_name} tier gives you a reduced fee of{' '}
                        {currentTier.cashout_fee_percent}%!
                      </span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCashout}
                    disabled={loading || parseFloat(amount || '0') <= 0}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm Cashout'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Cashed Out</p>
            <p className="text-2xl font-bold">R{totalCashedOut.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Cashouts</p>
            <p className="text-2xl font-bold">{pendingCashouts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Your Fee Rate</p>
            <p className="text-2xl font-bold">{feePercent}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashout History */}
      <Card>
        <CardHeader>
          <CardTitle>Cashout History</CardTitle>
          <CardDescription>Your recent withdrawal requests</CardDescription>
        </CardHeader>
        <CardContent>
          {cashouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No cashouts yet</p>
              <p className="text-sm">Your withdrawal history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cashouts.map((cashout) => (
                <div
                  key={cashout.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background">
                      <ArrowDownToLine className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {cashout.payment_method === 'bank_transfer'
                          ? 'Bank Transfer'
                          : cashout.payment_method === 'mobile_money'
                          ? 'Mobile Money'
                          : 'Instant Transfer'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cashout.created_at).toLocaleDateString()}
                        {cashout.processed_at && (
                          <> • Processed {new Date(cashout.processed_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R{cashout.net_amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      Fee: R{cashout.fee_amount.toFixed(2)}
                    </p>
                    {getStatusBadge(cashout.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverCashout;
