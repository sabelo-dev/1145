import React, { useState, useEffect } from 'react';
import { Bot, Zap, X, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProxyBid } from '@/hooks/useProxyBid';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface ProxyBidFormProps {
  auctionId: string;
  currentBid: number;
  bidIncrement: number;
  productName?: string;
}

const ProxyBidForm: React.FC<ProxyBidFormProps> = ({
  auctionId,
  currentBid,
  bidIncrement,
  productName,
}) => {
  const { user } = useAuth();
  const { proxyBid, setProxyBid, cancelProxyBid, toggleProxyBid, isSettingProxyBid, isCancelling } = useProxyBid(auctionId);
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>('');

  const minimumProxyBid = currentBid + bidIncrement;

  useEffect(() => {
    if (proxyBid) {
      setMaxAmount(proxyBid.max_amount.toString());
    } else {
      setMaxAmount(minimumProxyBid.toString());
    }
  }, [proxyBid, minimumProxyBid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(maxAmount);
    if (isNaN(amount) || amount < minimumProxyBid) {
      setError(`Maximum bid must be at least R${minimumProxyBid.toFixed(2)}`);
      return;
    }

    setProxyBid(auctionId, amount);
    setOpen(false);
  };

  const handleCancel = () => {
    cancelProxyBid(auctionId);
    setOpen(false);
  };

  const handleToggle = () => {
    if (proxyBid) {
      toggleProxyBid(auctionId, !proxyBid.is_active);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant={proxyBid ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Bot className="h-4 w-4" />
                {proxyBid ? (
                  <>
                    <span className="hidden sm:inline">Auto-bid: R{proxyBid.max_amount.toFixed(0)}</span>
                    <span className="sm:hidden">R{proxyBid.max_amount.toFixed(0)}</span>
                    {proxyBid.is_active ? (
                      <Badge variant="default" className="ml-1 text-xs px-1 py-0">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">Paused</Badge>
                    )}
                  </>
                ) : (
                  <span className="hidden sm:inline">Set Auto-bid</span>
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Set a maximum bid and we'll automatically bid for you</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Auto-Bid Settings
          </DialogTitle>
          <DialogDescription>
            {productName && <span className="font-medium">{productName}</span>}
            <br />
            Set your maximum bid and we'll automatically bid for you up to that amount.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current bid:</span>
              <span className="font-medium">R{currentBid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bid increment:</span>
              <span className="font-medium">R{bidIncrement.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minimum auto-bid:</span>
              <span className="font-medium text-primary">R{minimumProxyBid.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAmount">Your Maximum Bid (R)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                min={minimumProxyBid}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="pl-8"
                placeholder={minimumProxyBid.toString()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              We'll place the minimum bid needed to keep you in the lead, up to this amount.
            </p>
          </div>

          <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-medium">How it works:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-muted-foreground">
                  <li>We'll bid the minimum amount to stay in the lead</li>
                  <li>If someone outbids you, we'll automatically counter</li>
                  <li>Bidding stops when your maximum is reached</li>
                  <li>You can pause or cancel anytime</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isSettingProxyBid}
            >
              {isSettingProxyBid ? 'Saving...' : proxyBid ? 'Update Auto-bid' : 'Set Auto-bid'}
            </Button>
            
            {proxyBid && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleToggle}
                  title={proxyBid.is_active ? 'Pause' : 'Resume'}
                >
                  {proxyBid.is_active ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  title="Cancel auto-bid"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProxyBidForm;
