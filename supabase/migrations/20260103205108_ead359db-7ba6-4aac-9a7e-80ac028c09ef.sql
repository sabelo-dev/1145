-- Gold Pricing System for 1145 Marketplace
-- Gold (mgAu - milligrams) is the base unit of value

-- Table to cache gold prices from oracle
CREATE TABLE IF NOT EXISTS public.gold_price_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    price_per_oz_usd NUMERIC(12, 4) NOT NULL,
    price_per_gram_usd NUMERIC(12, 4) NOT NULL,
    price_per_mg_usd NUMERIC(12, 8) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT DEFAULT 'manual',
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Currency exchange rates table
CREATE TABLE IF NOT EXISTS public.currency_rates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    rate_to_usd NUMERIC(12, 6) NOT NULL, -- How many of this currency equals 1 USD
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(currency_code)
);

-- Add gold pricing columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price_mg_gold BIGINT,
ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'ZAR',
ADD COLUMN IF NOT EXISTS price_snapshot_gold_rate NUMERIC(12, 8),
ADD COLUMN IF NOT EXISTS price_snapshot_at TIMESTAMPTZ;

-- Add gold pricing columns to product_variations table
ALTER TABLE public.product_variations 
ADD COLUMN IF NOT EXISTS price_mg_gold BIGINT,
ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'ZAR';

-- Add gold pricing columns to order_items (snapshot at time of purchase)
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS price_mg_gold BIGINT,
ADD COLUMN IF NOT EXISTS gold_rate_at_purchase NUMERIC(12, 8);

-- Add gold pricing columns to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS total_mg_gold BIGINT,
ADD COLUMN IF NOT EXISTS gold_rate_at_checkout NUMERIC(12, 8);

-- Add gold balance to UCoin wallets (for potential gold-backed features)
ALTER TABLE public.ucoin_wallets 
ADD COLUMN IF NOT EXISTS gold_balance_mg BIGINT DEFAULT 0;

-- User preferences for currency display
CREATE TABLE IF NOT EXISTS public.user_currency_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    preferred_currency TEXT DEFAULT 'ZAR',
    display_mode TEXT DEFAULT 'currency', -- 'currency', 'gold', 'both'
    gold_unit TEXT DEFAULT 'mg', -- 'mg', 'g', 'oz'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendor currency settings
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS default_pricing_currency TEXT DEFAULT 'ZAR';

-- Store currency settings  
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS pricing_currency TEXT DEFAULT 'ZAR';

-- Enable RLS on new tables
ALTER TABLE public.gold_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_currency_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gold_price_cache (read-only for all authenticated users)
CREATE POLICY "Anyone can view gold prices" 
ON public.gold_price_cache FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage gold prices"
ON public.gold_price_cache FOR ALL
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for currency_rates (read-only for all, admin write)
CREATE POLICY "Anyone can view currency rates" 
ON public.currency_rates FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage currency rates"
ON public.currency_rates FOR ALL
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for user_currency_preferences
CREATE POLICY "Users can view own currency preferences" 
ON public.user_currency_preferences FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own currency preferences" 
ON public.user_currency_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own currency preferences" 
ON public.user_currency_preferences FOR UPDATE 
USING (auth.uid() = user_id);

-- Insert default currency rates
INSERT INTO public.currency_rates (currency_code, currency_name, currency_symbol, rate_to_usd)
VALUES 
    ('USD', 'US Dollar', '$', 1.000000),
    ('ZAR', 'South African Rand', 'R', 18.500000),
    ('EUR', 'Euro', '€', 0.920000),
    ('GBP', 'British Pound', '£', 0.790000),
    ('NGN', 'Nigerian Naira', '₦', 1550.000000),
    ('KES', 'Kenyan Shilling', 'KSh', 153.000000),
    ('GHS', 'Ghanaian Cedi', 'GH₵', 15.500000),
    ('BWP', 'Botswana Pula', 'P', 13.600000)
ON CONFLICT (currency_code) DO UPDATE SET 
    rate_to_usd = EXCLUDED.rate_to_usd,
    updated_at = now();

-- Insert initial gold price (will be updated by oracle)
-- Current approximate gold price: ~$2,650/oz
INSERT INTO public.gold_price_cache (price_per_oz_usd, price_per_gram_usd, price_per_mg_usd, source, is_current)
VALUES (
    2650.0000,                    -- price per oz
    85.2014,                      -- price per gram (2650 / 31.1035)
    0.08520140,                   -- price per mg
    'initial_seed',
    true
);

-- Function to get current gold price
CREATE OR REPLACE FUNCTION public.get_current_gold_price()
RETURNS TABLE (
    price_per_oz_usd NUMERIC,
    price_per_gram_usd NUMERIC,
    price_per_mg_usd NUMERIC,
    fetched_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gpc.price_per_oz_usd,
        gpc.price_per_gram_usd,
        gpc.price_per_mg_usd,
        gpc.fetched_at
    FROM gold_price_cache gpc
    WHERE gpc.is_current = true
    ORDER BY gpc.fetched_at DESC
    LIMIT 1;
END;
$$;

-- Function to convert currency to mg gold
CREATE OR REPLACE FUNCTION public.currency_to_mg_gold(
    p_amount NUMERIC,
    p_currency_code TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate_to_usd NUMERIC;
    v_gold_price_per_mg NUMERIC;
    v_amount_usd NUMERIC;
    v_mg_gold BIGINT;
BEGIN
    -- Get currency rate to USD
    SELECT rate_to_usd INTO v_rate_to_usd
    FROM currency_rates
    WHERE currency_code = p_currency_code AND is_active = true;
    
    IF v_rate_to_usd IS NULL THEN
        RAISE EXCEPTION 'Currency % not found or inactive', p_currency_code;
    END IF;
    
    -- Get current gold price per mg in USD
    SELECT gpc.price_per_mg_usd INTO v_gold_price_per_mg
    FROM gold_price_cache gpc
    WHERE gpc.is_current = true
    ORDER BY gpc.fetched_at DESC
    LIMIT 1;
    
    IF v_gold_price_per_mg IS NULL OR v_gold_price_per_mg = 0 THEN
        RAISE EXCEPTION 'No gold price available';
    END IF;
    
    -- Convert to USD first
    v_amount_usd := p_amount / v_rate_to_usd;
    
    -- Convert USD to mg gold (how many mg can this buy)
    v_mg_gold := FLOOR(v_amount_usd / v_gold_price_per_mg);
    
    RETURN v_mg_gold;
END;
$$;

-- Function to convert mg gold to currency
CREATE OR REPLACE FUNCTION public.mg_gold_to_currency(
    p_mg_gold BIGINT,
    p_currency_code TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rate_to_usd NUMERIC;
    v_gold_price_per_mg NUMERIC;
    v_amount_usd NUMERIC;
    v_amount_currency NUMERIC;
BEGIN
    -- Get currency rate to USD
    SELECT rate_to_usd INTO v_rate_to_usd
    FROM currency_rates
    WHERE currency_code = p_currency_code AND is_active = true;
    
    IF v_rate_to_usd IS NULL THEN
        RAISE EXCEPTION 'Currency % not found or inactive', p_currency_code;
    END IF;
    
    -- Get current gold price per mg in USD
    SELECT gpc.price_per_mg_usd INTO v_gold_price_per_mg
    FROM gold_price_cache gpc
    WHERE gpc.is_current = true
    ORDER BY gpc.fetched_at DESC
    LIMIT 1;
    
    IF v_gold_price_per_mg IS NULL THEN
        RAISE EXCEPTION 'No gold price available';
    END IF;
    
    -- Convert mg gold to USD
    v_amount_usd := p_mg_gold::NUMERIC * v_gold_price_per_mg;
    
    -- Convert USD to target currency
    v_amount_currency := v_amount_usd * v_rate_to_usd;
    
    RETURN ROUND(v_amount_currency, 2);
END;
$$;

-- Function to update product gold price when creating/updating
CREATE OR REPLACE FUNCTION public.update_product_gold_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_currency TEXT;
    v_gold_rate NUMERIC;
BEGIN
    -- Get currency from store or default to ZAR
    v_currency := COALESCE(NEW.price_currency, 'ZAR');
    
    -- Get current gold rate
    SELECT price_per_mg_usd INTO v_gold_rate
    FROM gold_price_cache
    WHERE is_current = true
    ORDER BY fetched_at DESC
    LIMIT 1;
    
    -- Calculate gold price
    NEW.price_mg_gold := public.currency_to_mg_gold(NEW.price, v_currency);
    NEW.price_snapshot_gold_rate := v_gold_rate;
    NEW.price_snapshot_at := now();
    
    RETURN NEW;
END;
$$;

-- Trigger to auto-calculate gold price on product insert/update
CREATE TRIGGER calculate_product_gold_price
    BEFORE INSERT OR UPDATE OF price, price_currency ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_gold_price();

-- Create index for faster gold price lookups
CREATE INDEX IF NOT EXISTS idx_gold_price_cache_current ON public.gold_price_cache (is_current, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_rates_code ON public.currency_rates (currency_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_gold_price ON public.products (price_mg_gold);
CREATE INDEX IF NOT EXISTS idx_user_currency_prefs_user ON public.user_currency_preferences (user_id);