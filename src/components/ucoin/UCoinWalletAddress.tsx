import { useState } from 'react';
import { Copy, Check, Wallet, QrCode, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UCoinWallet } from '@/types/ucoin';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UCoinWalletAddressProps {
  wallet: UCoinWallet | null;
  isLoading?: boolean;
}

export function UCoinWalletAddress({ wallet, isLoading }: UCoinWalletAddressProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const walletAddress = wallet?.user_id || '';
  const shortAddress = walletAddress 
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`
    : '';

  const copyToClipboard = async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Wallet address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy address');
    }
  };

  const shareAddress = async () => {
    if (!walletAddress) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My UCoin Wallet Address',
          text: `Send UCoin to my wallet: ${walletAddress}`,
        });
      } catch (err) {
        // User cancelled or share failed
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-600" />
          Your Wallet Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Share this address to receive UCoin from other users
        </p>
        
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/50 rounded-lg p-3 font-mono text-sm break-all border border-border">
            {shortAddress || 'No wallet found'}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  disabled={!walletAddress}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy full address'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={shareAddress}
                  disabled={!walletAddress}
                  className="shrink-0"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share address</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {walletAddress && (
          <div 
            className="text-xs text-muted-foreground bg-muted/30 rounded p-2 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={copyToClipboard}
          >
            <span className="font-medium">Full address:</span>
            <br />
            <span className="font-mono break-all">{walletAddress}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
