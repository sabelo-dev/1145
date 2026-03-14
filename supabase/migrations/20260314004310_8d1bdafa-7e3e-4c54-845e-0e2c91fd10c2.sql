
-- Add gold balance to platform_wallets
ALTER TABLE public.platform_wallets 
  ADD COLUMN IF NOT EXISTS gold_balance_mg BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_gold_bought_mg BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_gold_sold_mg BIGINT NOT NULL DEFAULT 0;

-- Add asset_type to wallet_transactions for multi-asset tracking
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'ZAR';

-- Create gold_trades table for buy/sell order history
CREATE TABLE IF NOT EXISTS public.gold_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.platform_wallets(id),
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  gold_mg BIGINT NOT NULL,
  gold_price_per_mg_usd NUMERIC NOT NULL,
  fiat_amount NUMERIC NOT NULL,
  fiat_currency TEXT NOT NULL DEFAULT 'ZAR',
  spread_percent NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  gold_price_snapshot_id UUID,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gold_trades ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own trades
CREATE POLICY "Users can view own gold trades"
  ON public.gold_trades FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: Users can insert their own trades
CREATE POLICY "Users can create own gold trades"
  ON public.gold_trades FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_gold_trades_user_id ON public.gold_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_gold_trades_created_at ON public.gold_trades(created_at DESC);
