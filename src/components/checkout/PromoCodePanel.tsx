import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { formatCurrency } from "@/lib/utils";

export interface AppliedPromo {
  code: string;
  /** Rand off the order total, VAT and shipping included. */
  savings: number;
  freeShipping: boolean;
}

interface PromoCodePanelProps {
  promo: AppliedPromo | null;
  onChange: (promo: AppliedPromo | null) => void;
}

const PromoCodePanel: React.FC<PromoCodePanelProps> = ({ promo, onChange }) => {
  const { cart } = useCart();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartKey = (cart?.items ?? [])
    .map((i) => `${i.productId}:${i.variationId ?? ""}:${i.quantity}`)
    .join("|");

  // The server prices the cart and validates the code; the same check runs again when paying.
  const quote = async (promoCode: string): Promise<AppliedPromo | string> => {
    const { data, error: invokeError } = await supabase.functions.invoke("payfast-payment", {
      body: {
        quoteOnly: true,
        promoCode,
        cartItems: (cart?.items ?? []).map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variationId: item.variationId,
        })),
      },
    });
    const applied = data?.quote?.promo;
    if (invokeError || !data?.success || !applied) {
      return data?.error || "Could not check that promo code. Please try again.";
    }
    return { code: applied.code, savings: Number(applied.savings) || 0, freeShipping: !!applied.freeShipping };
  };

  const apply = async () => {
    const entered = code.trim();
    if (!entered || checking) return;
    setChecking(true);
    setError(null);
    const result = await quote(entered);
    setChecking(false);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    onChange(result);
    setCode("");
  };

  // Cart changed while a code is applied: the discount may differ or no longer qualify.
  const quotedCartKey = useRef(cartKey);
  useEffect(() => {
    if (!promo) {
      quotedCartKey.current = cartKey;
      return;
    }
    if (quotedCartKey.current === cartKey) return;
    quotedCartKey.current = cartKey;
    let cancelled = false;
    quote(promo.code).then((result) => {
      if (cancelled) return;
      if (typeof result === "string") {
        onChange(null);
        setError(result);
      } else {
        onChange(result);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, promo?.code]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium">Promo code</span>
        </div>

        {promo ? (
          <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{promo.code}</p>
              <p className="text-xs text-muted-foreground">
                {promo.savings > 0 ? `You save ${formatCurrency(promo.savings)}` : "Applied"}
                {promo.freeShipping && " · free shipping"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 px-2"
              onClick={() => { onChange(null); setError(null); }}
              aria-label={`Remove promo code ${promo.code}`}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="promo-code" className="sr-only">Promo code</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                value={code}
                placeholder="Enter code"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                className="min-w-0 flex-1 uppercase placeholder:normal-case"
                aria-invalid={!!error}
                aria-describedby={error ? "promo-code-error" : undefined}
                onChange={(e) => { setCode(e.target.value); setError(null); }}
                onKeyDown={(e) => {
                  // Enter here applies the code instead of submitting the whole order.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    apply();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={apply}
                disabled={checking || !code.trim()}
              >
                {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply
              </Button>
            </div>
            {error && (
              <p id="promo-code-error" role="alert" className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromoCodePanel;
