import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Coins } from "lucide-react";
import { useUCoin } from "@/hooks/useUCoin";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

interface UCoinPayPanelProps {
  total: number;
  ucoinToApply: number;
  onChange: (ucoin: number) => void;
}

const money = (v: number) => `R${v.toFixed(2)}`;

const UCoinPayPanel: React.FC<UCoinPayPanelProps> = ({ total, ucoinToApply, onChange }) => {
  const { wallet, isLoading } = useUCoin();
  const balance = wallet?.balance ?? 0;

  const maxUcoin = useMemo(
    () => Math.max(0, Math.min(balance, Math.floor(total / UCOIN_RAND_VALUE))),
    [balance, total],
  );

  const applied = Math.min(ucoinToApply, maxUcoin);
  const discount = applied * UCOIN_RAND_VALUE;
  const due = Math.max(total - discount, 0);

  if (isLoading || balance <= 0) return null;

  return (
    <Card className="border-gold/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-gold" />
          <span className="font-medium">Pay with UCoin</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {balance.toLocaleString()} available
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Every UCoin you mined is worth {money(UCOIN_RAND_VALUE)}. Use them here and pay the rest with money.
        </p>

        <div className="space-y-2">
          <Label htmlFor="ucoin-apply">UCoin to use</Label>
          <div className="flex gap-2">
            <Input
              id="ucoin-apply"
              type="number"
              inputMode="numeric"
              min={0}
              max={maxUcoin}
              value={applied || ""}
              placeholder="0"
              onChange={(e) => {
                const next = Math.floor(Number(e.target.value) || 0);
                onChange(Math.max(0, Math.min(next, maxUcoin)));
              }}
            />
            <Button type="button" variant="outline" onClick={() => onChange(maxUcoin)}>
              Use max
            </Button>
          </div>
        </div>

        {applied > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">UCoin covers</span>
              <span className="font-medium">-{money(discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Still to pay</span>
              <span className="font-semibold">{money(due)}</span>
            </div>
            {due === 0 && (
              <p className="text-xs text-primary">Your UCoin covers this order in full — no card needed.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UCoinPayPanel;
