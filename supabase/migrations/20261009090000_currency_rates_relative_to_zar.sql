-- Exchange rates are now quoted against the rand, the currency prices are stored and charged in.
--
--   currency_rates.rate_to_zar = how many units of this currency equal R1.
--   ZAR is always 1.  1 US dollar at R17 is 0.058824.  1 UCoin at R0.10 is 10.
--
-- Gold is still quoted in US dollars (gold_price_cache.price_per_mg_usd), so a USD row
-- must exist for gold conversions. It does not have to be active: "active" only decides
-- whether customers can pick a currency to view prices in.
--
-- The column rename, the data conversion and the two conversion functions change
-- together, so the product gold-price trigger never sees a half-applied state.
-- Existing rates keep their meaning: converted values give the same results as before.

DO $$
DECLARE
  v_zar_per_usd numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'currency_rates' AND column_name = 'rate_to_usd') THEN

    SELECT rate_to_usd INTO v_zar_per_usd FROM public.currency_rates WHERE currency_code = 'ZAR';
    IF v_zar_per_usd IS NULL OR v_zar_per_usd <= 0 THEN
      RAISE EXCEPTION 'currency_rates has no usable ZAR rate to convert from';
    END IF;

    ALTER TABLE public.currency_rates RENAME COLUMN rate_to_usd TO rate_to_zar;
    ALTER TABLE public.currency_rates ALTER COLUMN rate_to_zar TYPE numeric(18, 8);

    -- "per 1 USD" → "per 1 ZAR"
    UPDATE public.currency_rates SET rate_to_zar = rate_to_zar / v_zar_per_usd, updated_at = now() WHERE currency_code <> 'ZAR';
    UPDATE public.currency_rates SET rate_to_zar = 1 WHERE currency_code = 'ZAR';

    -- Gold needs the dollar. Added hidden from customers if it was not there.
    INSERT INTO public.currency_rates (currency_code, currency_name, currency_symbol, rate_to_zar, is_active)
    VALUES ('USD', 'US Dollar', '$', 1 / v_zar_per_usd, false)
    ON CONFLICT (currency_code) DO NOTHING;

    -- UCoin is worth R0.10 everywhere else in the app (UCOIN_RAND_VALUE); the stored
    -- rate said otherwise (0.01 per dollar, i.e. about R1,700 per UCoin).
    UPDATE public.currency_rates SET rate_to_zar = 10 WHERE currency_code = 'UC';
  END IF;
END $$;

COMMENT ON COLUMN public.currency_rates.rate_to_zar IS 'How many units of this currency equal 1 ZAR. ZAR itself is 1.';

DO $$
BEGIN
  ALTER TABLE public.currency_rates ADD CONSTRAINT currency_rates_rate_positive CHECK (rate_to_zar > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.currency_rates ADD CONSTRAINT currency_rates_zar_is_base CHECK (currency_code <> 'ZAR' OR rate_to_zar = 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- US dollars per R1, for gold. Read whether or not USD is offered to customers.
CREATE OR REPLACE FUNCTION public.usd_per_zar()
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate_to_zar INTO v_rate FROM currency_rates WHERE currency_code = 'USD';
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'A USD rate is required to price gold. Add USD under Currency Exchange Rates.';
  END IF;
  RETURN v_rate;
END;
$$;
REVOKE ALL ON FUNCTION public.usd_per_zar() FROM PUBLIC, anon, authenticated;

-- Currency amount → milligrams of gold: currency → rand → dollars → gold.
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
    v_rate_to_zar NUMERIC;
    v_gold_price_per_mg NUMERIC;
    v_amount_usd NUMERIC;
BEGIN
    SELECT rate_to_zar INTO v_rate_to_zar
    FROM currency_rates
    WHERE currency_code = p_currency_code AND is_active = true;

    IF v_rate_to_zar IS NULL THEN
        RAISE EXCEPTION 'Currency % not found or inactive', p_currency_code;
    END IF;

    SELECT gpc.price_per_mg_usd INTO v_gold_price_per_mg
    FROM gold_price_cache gpc
    WHERE gpc.is_current = true
    ORDER BY gpc.fetched_at DESC
    LIMIT 1;

    IF v_gold_price_per_mg IS NULL OR v_gold_price_per_mg = 0 THEN
        RAISE EXCEPTION 'No gold price available';
    END IF;

    v_amount_usd := (p_amount / v_rate_to_zar) * public.usd_per_zar();

    RETURN FLOOR(v_amount_usd / v_gold_price_per_mg);
END;
$$;

-- Milligrams of gold → currency amount: gold → dollars → rand → currency.
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
    v_rate_to_zar NUMERIC;
    v_gold_price_per_mg NUMERIC;
    v_amount_zar NUMERIC;
BEGIN
    SELECT rate_to_zar INTO v_rate_to_zar
    FROM currency_rates
    WHERE currency_code = p_currency_code AND is_active = true;

    IF v_rate_to_zar IS NULL THEN
        RAISE EXCEPTION 'Currency % not found or inactive', p_currency_code;
    END IF;

    SELECT gpc.price_per_mg_usd INTO v_gold_price_per_mg
    FROM gold_price_cache gpc
    WHERE gpc.is_current = true
    ORDER BY gpc.fetched_at DESC
    LIMIT 1;

    IF v_gold_price_per_mg IS NULL THEN
        RAISE EXCEPTION 'No gold price available';
    END IF;

    v_amount_zar := (p_mg_gold::NUMERIC * v_gold_price_per_mg) / public.usd_per_zar();

    RETURN ROUND(v_amount_zar * v_rate_to_zar, 2);
END;
$$;
