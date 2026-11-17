\timing off
SELECT t_as('00000000-0000-0000-0000-0000000000a2');
SET ROLE authenticated;
\echo === dispatcher: count at_hub (RLS as written)
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT count(*) FROM shipments WHERE status = 'at_hub';
\echo === dispatcher: latest 500 shipments (Shipments page)
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM shipments ORDER BY created_at DESC LIMIT 500;
RESET ROLE;
\echo === same query as postgres (no RLS) for comparison
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT count(*) FROM shipments WHERE status = 'at_hub';
