-- Indexes for the Merchant AI queries.
--
-- The order console polls merchant_order_queue() every 10 seconds per tablet,
-- and the analytics, stock and AI functions all read order lines, products and
-- variants by store or product. These tables were created outside the
-- migrations folder, so production may already have suitable indexes: each is
-- created only when no existing index starts with the same column, so nothing
-- is duplicated. Plain CREATE INDEX (not CONCURRENTLY) because the SQL Editor
-- runs in a transaction; on these table sizes it takes moments.

DO $$
DECLARE
  wanted record;
BEGIN
  FOR wanted IN
    SELECT * FROM (VALUES
      ('order_items', 'store_id', 'idx_order_items_store_status', '(store_id, merchant_status)'),
      ('order_items', 'order_id', 'idx_order_items_order', '(order_id)'),
      ('order_items', 'product_id', 'idx_order_items_product', '(product_id)'),
      ('products', 'store_id', 'idx_products_store', '(store_id)'),
      ('product_variations', 'product_id', 'idx_product_variations_product', '(product_id)'),
      ('orders', 'user_id', 'idx_orders_user', '(user_id)')
    ) AS w(tbl, lead_column, index_name, columns)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
       WHERE n.nspname = 'public' AND t.relname = wanted.tbl AND a.attname = wanted.lead_column
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I %s', wanted.index_name, wanted.tbl, wanted.columns);
      RAISE NOTICE 'Created %', wanted.index_name;
    END IF;
  END LOOP;
END $$;
