
-- ============ SUPPLIERS ============
CREATE TABLE public.dropship_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  adapter text NOT NULL DEFAULT 'cjdropshipping',
  status text NOT NULL DEFAULT 'inactive',
  health text NOT NULL DEFAULT 'offline',
  logo_url text,
  country text,
  base_currency text NOT NULL DEFAULT 'USD',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_secret_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_stock integer NOT NULL DEFAULT 2,
  pricing_rule jsonb NOT NULL DEFAULT '{"payment_fee_pct":3.5,"platform_fee_pct":7,"merchant_margin_pct":30,"risk_allowance_pct":3,"operational_fee_flat":15,"rounding":"nearest_10","fx_buffer_pct":4}'::jsonb,
  shipping_rule jsonb NOT NULL DEFAULT '{"strategy":"passthrough","flat_zar":0,"markup_pct":0,"free_over_zar":null}'::jsonb,
  sync_intervals jsonb NOT NULL DEFAULT '{"products_minutes":1440,"inventory_minutes":60,"orders_minutes":30,"tracking_minutes":120}'::jsonb,
  auto_price_update boolean NOT NULL DEFAULT false,
  last_products_sync_at timestamptz,
  last_inventory_sync_at timestamptz,
  last_orders_sync_at timestamptz,
  last_health_check_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  avg_response_ms integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_suppliers TO authenticated;
GRANT ALL ON public.dropship_suppliers TO service_role;
ALTER TABLE public.dropship_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppliers" ON public.dropship_suppliers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Vendors view active supplier names" ON public.dropship_suppliers FOR SELECT TO authenticated USING (status = 'active' AND public.is_vendor(auth.uid()));

-- ============ CATALOGUE ============
CREATE TABLE public.dropship_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.dropship_suppliers(id) ON DELETE CASCADE,
  supplier_product_id text NOT NULL,
  supplier_sku text,
  name text NOT NULL,
  description text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text,
  supplier_category text,
  supplier_cost numeric(12,2) NOT NULL DEFAULT 0,
  supplier_currency text NOT NULL DEFAULT 'USD',
  supplier_shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  weight_grams integer,
  stock integer NOT NULL DEFAULT 0,
  warehouse text,
  landed_cost_zar numeric(12,2) NOT NULL DEFAULT 0,
  recommended_price_zar numeric(12,2) NOT NULL DEFAULT 0,
  fx_rate numeric(14,6) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'imported',
  rejection_reason text,
  suspension_reason text,
  sync_status text NOT NULL DEFAULT 'ok',
  sync_error text,
  last_synced_at timestamptz,
  imported_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_products TO authenticated;
GRANT ALL ON public.dropship_products TO service_role;
ALTER TABLE public.dropship_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage catalogue" ON public.dropship_products FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Vendors view approved catalogue" ON public.dropship_products FOR SELECT TO authenticated USING (status IN ('approved','published') AND public.is_vendor(auth.uid()));

CREATE TABLE public.dropship_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dropship_product_id uuid NOT NULL REFERENCES public.dropship_products(id) ON DELETE CASCADE,
  supplier_variant_id text NOT NULL,
  sku text,
  name text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  supplier_cost numeric(12,2) NOT NULL DEFAULT 0,
  supplier_shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  recommended_price_zar numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  weight_grams integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dropship_product_id, supplier_variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_variants TO authenticated;
GRANT ALL ON public.dropship_variants TO service_role;
ALTER TABLE public.dropship_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage variants" ON public.dropship_variants FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Vendors view approved variants" ON public.dropship_variants FOR SELECT TO authenticated USING (public.is_vendor(auth.uid()) AND EXISTS (SELECT 1 FROM public.dropship_products p WHERE p.id = dropship_product_id AND p.status IN ('approved','published')));

-- ============ MERCHANT LISTINGS ============
CREATE TABLE public.dropship_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  dropship_product_id uuid NOT NULL REFERENCES public.dropship_products(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  auto_price_update boolean NOT NULL DEFAULT true,
  price_change_flag boolean NOT NULL DEFAULT false,
  units_sold integer NOT NULL DEFAULT 0,
  revenue_zar numeric(14,2) NOT NULL DEFAULT 0,
  profit_zar numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, dropship_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_listings TO authenticated;
GRANT ALL ON public.dropship_listings TO service_role;
ALTER TABLE public.dropship_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage listings" ON public.dropship_listings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Vendors manage own listings" ON public.dropship_listings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));

-- ============ FULFILMENT ============
CREATE TABLE public.dropship_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.dropship_suppliers(id) ON DELETE RESTRICT,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  supplier_order_number text,
  status text NOT NULL DEFAULT 'paid',
  supplier_status text,
  supplier_cost_total numeric(12,2) NOT NULL DEFAULT 0,
  supplier_shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  supplier_currency text NOT NULL DEFAULT 'USD',
  fx_rate numeric(14,6) NOT NULL DEFAULT 1,
  cost_total_zar numeric(12,2) NOT NULL DEFAULT 0,
  customer_shipping_zar numeric(12,2) NOT NULL DEFAULT 0,
  carrier text,
  tracking_number text,
  tracking_url text,
  estimated_delivery date,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  submitted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_fulfillments TO authenticated;
GRANT ALL ON public.dropship_fulfillments TO service_role;
ALTER TABLE public.dropship_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fulfillments" ON public.dropship_fulfillments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Vendors view own fulfillments" ON public.dropship_fulfillments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "Customers view own fulfillments" ON public.dropship_fulfillments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE TABLE public.dropship_fulfillment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.dropship_fulfillments(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  dropship_product_id uuid REFERENCES public.dropship_products(id) ON DELETE SET NULL,
  dropship_variant_id uuid REFERENCES public.dropship_variants(id) ON DELETE SET NULL,
  supplier_variant_id text,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  unit_price_zar numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_fulfillment_items TO authenticated;
GRANT ALL ON public.dropship_fulfillment_items TO service_role;
ALTER TABLE public.dropship_fulfillment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fulfillment items" ON public.dropship_fulfillment_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Related users view fulfillment items" ON public.dropship_fulfillment_items FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dropship_fulfillments f LEFT JOIN public.vendors v ON v.id = f.vendor_id LEFT JOIN public.orders o ON o.id = f.order_id
  WHERE f.id = fulfillment_id AND (v.user_id = auth.uid() OR o.user_id = auth.uid())));

CREATE TABLE public.dropship_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.dropship_fulfillments(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, status, occurred_at)
);
GRANT SELECT, INSERT ON public.dropship_tracking_events TO authenticated;
GRANT ALL ON public.dropship_tracking_events TO service_role;
ALTER TABLE public.dropship_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view tracking" ON public.dropship_tracking_events FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Related users view tracking" ON public.dropship_tracking_events FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dropship_fulfillments f LEFT JOIN public.vendors v ON v.id = f.vendor_id LEFT JOIN public.orders o ON o.id = f.order_id
  WHERE f.id = fulfillment_id AND (v.user_id = auth.uid() OR o.user_id = auth.uid())));

-- ============ RETURNS & REFUNDS ============
CREATE TABLE public.dropship_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.dropship_fulfillments(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'requested',
  resolution text,
  refund_amount numeric(12,2),
  supplier_return_ref text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.dropship_returns TO authenticated;
GRANT ALL ON public.dropship_returns TO service_role;
ALTER TABLE public.dropship_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage returns" ON public.dropship_returns FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Customers create own returns" ON public.dropship_returns FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Customers view own returns" ON public.dropship_returns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Vendors view own returns" ON public.dropship_returns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));

CREATE TABLE public.dropship_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  return_id uuid REFERENCES public.dropship_returns(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  method text NOT NULL DEFAULT 'wallet',
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  idempotency_key text NOT NULL UNIQUE,
  processed_by uuid,
  processed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropship_refunds TO authenticated;
GRANT ALL ON public.dropship_refunds TO service_role;
ALTER TABLE public.dropship_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage refunds" ON public.dropship_refunds FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Customers view own refunds" ON public.dropship_refunds FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ OPERATIONS: PRICE HISTORY, AUDIT, SYNC, LOGS, WEBHOOKS ============
CREATE TABLE public.dropship_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dropship_product_id uuid NOT NULL REFERENCES public.dropship_products(id) ON DELETE CASCADE,
  old_supplier_cost numeric(12,2),
  new_supplier_cost numeric(12,2),
  old_recommended_price numeric(12,2),
  new_recommended_price numeric(12,2),
  change_pct numeric(8,2),
  source text NOT NULL DEFAULT 'sync',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropship_price_history TO authenticated;
GRANT ALL ON public.dropship_price_history TO service_role;
ALTER TABLE public.dropship_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view price history" ON public.dropship_price_history FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.dropship_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropship_audit_log TO authenticated;
GRANT ALL ON public.dropship_audit_log TO service_role;
ALTER TABLE public.dropship_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view dropship audit" ON public.dropship_audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.dropship_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.dropship_suppliers(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropship_sync_jobs TO authenticated;
GRANT ALL ON public.dropship_sync_jobs TO service_role;
ALTER TABLE public.dropship_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view sync jobs" ON public.dropship_sync_jobs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.dropship_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.dropship_suppliers(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  status_code integer,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_type text,
  error_message text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dropship_api_logs TO authenticated;
GRANT ALL ON public.dropship_api_logs TO service_role;
ALTER TABLE public.dropship_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view api logs" ON public.dropship_api_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.dropship_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.dropship_suppliers(id) ON DELETE CASCADE,
  external_event_id text,
  event_type text,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  process_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, external_event_id)
);
GRANT SELECT ON public.dropship_webhook_events TO authenticated;
GRANT ALL ON public.dropship_webhook_events TO service_role;
ALTER TABLE public.dropship_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view webhook events" ON public.dropship_webhook_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ INDEXES ============
CREATE INDEX idx_ds_products_supplier_status ON public.dropship_products(supplier_id, status);
CREATE INDEX idx_ds_products_stock ON public.dropship_products(stock);
CREATE INDEX idx_ds_variants_product ON public.dropship_variants(dropship_product_id);
CREATE INDEX idx_ds_listings_vendor ON public.dropship_listings(vendor_id);
CREATE INDEX idx_ds_listings_product ON public.dropship_listings(product_id);
CREATE INDEX idx_ds_fulfillments_order ON public.dropship_fulfillments(order_id);
CREATE INDEX idx_ds_fulfillments_status ON public.dropship_fulfillments(status);
CREATE INDEX idx_ds_tracking_fulfillment ON public.dropship_tracking_events(fulfillment_id);
CREATE INDEX idx_ds_audit_created ON public.dropship_audit_log(created_at DESC);
CREATE INDEX idx_ds_api_logs_created ON public.dropship_api_logs(supplier_id, created_at DESC);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_ds_suppliers_updated BEFORE UPDATE ON public.dropship_suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_products_updated BEFORE UPDATE ON public.dropship_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_variants_updated BEFORE UPDATE ON public.dropship_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_listings_updated BEFORE UPDATE ON public.dropship_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_fulfillments_updated BEFORE UPDATE ON public.dropship_fulfillments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_returns_updated BEFORE UPDATE ON public.dropship_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ds_refunds_updated BEFORE UPDATE ON public.dropship_refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ledger-style immutability for the dropship audit trail
CREATE OR REPLACE FUNCTION public.dropship_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'dropship_audit_log records are immutable';
END;
$$;
CREATE TRIGGER trg_ds_audit_immutable BEFORE UPDATE OR DELETE ON public.dropship_audit_log FOR EACH ROW EXECUTE FUNCTION public.dropship_audit_immutable();

-- Available stock net of safety stock
CREATE OR REPLACE FUNCTION public.dropship_available_stock(p_product_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, p.stock - s.safety_stock)
  FROM public.dropship_products p JOIN public.dropship_suppliers s ON s.id = p.supplier_id
  WHERE p.id = p_product_id;
$$;

-- Seed the first supplier
INSERT INTO public.dropship_suppliers (code, name, adapter, status, country, base_currency, credential_secret_names)
VALUES ('cjdropshipping', 'CJdropshipping', 'cjdropshipping', 'inactive', 'CN', 'USD', '["CJ_EMAIL","CJ_API_KEY"]'::jsonb)
ON CONFLICT (code) DO NOTHING;
