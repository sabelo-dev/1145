import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUCoin } from "@/hooks/useUCoin";

export default function FullUCoinPayment({ total, pay, disabled = false, onBusyChange }: {
  total: number; pay: () => Promise<void>; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const { wallet, isLoading, refreshWallet } = useUCoin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needed = Math.ceil(Math.round(total * 100) / 10);
  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled || busy || isLoading || needed <= 0 || (wallet?.balance ?? 0) < needed}
      onClick={async () => {
        if (!window.confirm(`Pay R${total.toFixed(2)} with ${needed.toLocaleString()} UCoin?`)) return;
        setBusy(true); onBusyChange?.(true); setError("");
        try { await pay(); await refreshWallet(); }
        catch (e) { setError(e instanceof Error ? e.message : "Could not pay with UCoin"); }
        finally { setBusy(false); onBusyChange?.(false); }
      }}>{busy ? "Processing payment..." : `Pay with ${needed.toLocaleString()} UCoin`}</Button>
    <p className="text-xs text-muted-foreground">{(wallet?.balance ?? 0).toLocaleString()} UCoin available. 1 UCoin = R0.10.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
