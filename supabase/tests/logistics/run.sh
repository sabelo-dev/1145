#!/usr/bin/env bash
# 1145 Logistics database tests on a throwaway local PostgreSQL (no Supabase needed).
#
#   bash supabase/tests/logistics/run.sh            # rebuild + replay all migrations + e2e
#   PG_BIN="/c/Program Files/PostgreSQL/18/bin" bash supabase/tests/logistics/run.sh
#
# Base tables come from src/integrations/supabase/types.ts (the repo's migration
# history doesn't contain the original base schema). Supabase pieces (roles,
# auth.uid()/jwt(), storage, pg_net) are stubbed in 00_supabase_stubs.sql.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"; PORT="${PG_TEST_PORT:-55432}"
WORK="${TEMP:-${TMPDIR:-/tmp}}/lx-pgtest"; DATA="$WORK/data"
mkdir -p "$WORK"
if ! "$PG_BIN/pg_isready" -h localhost -p "$PORT" >/dev/null 2>&1; then
  [ -d "$DATA" ] || "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
  # pg_ctl keeps the shell attached on Windows; detach it.
  ("$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=localhost" -l "$WORK/pg.log" start >/dev/null 2>&1 &) ; sleep 4
fi
P() { "$PG_BIN/psql" -h localhost -p "$PORT" -U postgres -q -v ON_ERROR_STOP=0 "$@"; }
node "$HERE/gen_base.mjs" "$REPO/src/integrations/supabase/types.ts" "$WORK/01_base_schema.sql" >/dev/null
P -d postgres -c "DROP DATABASE IF EXISTS lx WITH (FORCE)" >/dev/null 2>&1; P -d postgres -c "CREATE DATABASE lx" >/dev/null
P -d lx -f "$HERE/00_supabase_stubs.sql" >/dev/null 2>&1
P -d lx -f "$WORK/01_base_schema.sql" >/dev/null 2>&1
P -d lx -c "ALTER TABLE public.driver_locations ADD CONSTRAINT driver_locations_driver_id_key UNIQUE (driver_id)" >/dev/null 2>&1 || true
# Unique keys the platform upserts on (types.ts carries no constraints).
P -d lx -c "ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)" >/dev/null 2>&1 || true
errs=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  b=$(basename "$f")
  if [[ "$b" > "20261116" ]]; then
    out=$(P -d lx -f "$f" 2>&1 | grep ERROR | grep -v 'extension "pg_net" is not available' || true)
    [ -n "$out" ] && { echo "[$b] $out"; errs=$((errs+1)); }
  else P -d lx -f "$f" >/dev/null 2>&1 || true; fi
done
echo "logistics migrations with errors: $errs"
"$PG_BIN/psql" -h localhost -p "$PORT" -U postgres -d lx -f "$HERE/10_e2e.sql" > "$WORK/e2e.out" 2>&1 || true
echo "e2e checks passed: $(grep -c 'PASS  ' "$WORK/e2e.out")"
grep -E "FAIL|ERROR" "$WORK/e2e.out" | head -5 || true
# Contract check: every literal rpc()/from() call in logistics code vs. the real schema.
"$PG_BIN/psql" -h localhost -p "$PORT" -U postgres -d lx -tAc "
select json_build_object(
 'tables', (select json_object_agg(table_name, cols) from (select table_name, json_agg(column_name order by ordinal_position) cols from information_schema.columns where table_schema='public' group by table_name) t),
 'procs', (select json_object_agg(proname, defs) from (select p.proname, json_agg(json_build_object('args', coalesce(p.proargnames[1:p.pronargs], '{}'), 'required', p.pronargs - p.pronargdefaults)) defs from pg_proc p where p.pronamespace='public'::regnamespace group by p.proname) x))" > "$WORK/schema.json"
contract_ok=0
( cd "$REPO" && node "$HERE/contract-check.mjs" "$WORK/schema.json"     $(ls src/logistics/*.tsx src/logistics/*/*.ts* src/components/driver/DriverRouteRun.tsx src/components/driver/routeOfflineQueue.ts src/components/driver/DriverDashboard.tsx src/components/driver/ProofOfDelivery.tsx src/components/driver/DriverActiveDeliveries.tsx          src/pages/PackageSendPage.tsx src/pages/TrackOrderPage.tsx supabase/functions/logistics-*/index.ts 2>/dev/null) ) || contract_ok=1

# Route optimiser: bundle logistics-dispatch with its helpers exported.
COPY="$REPO/supabase/functions/logistics-dispatch/__opt_test_copy.ts"
sed 's#"https://esm.sh/@supabase/supabase-js@2.49.4"#"@supabase/supabase-js"#' "$REPO/supabase/functions/logistics-dispatch/index.ts" > "$COPY"
printf '
export { optimizeOrder, isValidOrder, pathKm, windowBounds, co2FactorFor, haversineKm };
' >> "$COPY"
( cd "$REPO" && npx --yes esbuild "$COPY" --bundle --platform=node --format=esm --outfile="$WORK/dispatch.mjs" --log-level=error ); rm -f "$COPY"
opt_ok=0
node "$HERE/route-optimizer.test.mjs" "$(cd "$WORK" && pwd -W 2>/dev/null || pwd)/dispatch.mjs" | tail -1 || opt_ok=1

# Edge functions at runtime (HTTP behaviour; Supabase + outbound HTTP mocked in-process).
mkdir -p "$WORK/fn"
for f in logistics-api logistics-dispatch logistics-billing-run logistics-invoice-email logistics-notify; do
  T="$REPO/supabase/functions/$f/__node_test_copy.ts"
  sed 's#"https://esm.sh/@supabase/supabase-js@2.49.4"#"@supabase/supabase-js"#' "$REPO/supabase/functions/$f/index.ts" > "$T"
  ( cd "$REPO" && npx --yes esbuild "$T" --bundle --platform=node --format=esm --outfile="$WORK/fn/$f.mjs" --log-level=error ); rm -f "$T"
done
http_ok=0
node "$HERE/edge-functions.test.mjs" "$(cd "$WORK/fn" && pwd -W 2>/dev/null || pwd)" | tail -1 || http_ok=1

# Edge functions: strict type-check (Deno globals stubbed, esm.sh mapped to node_modules).
WREPO="$(cd "$REPO" && pwd -W 2>/dev/null || pwd)"
cat > "$WORK/deno.d.ts" <<'TSEOF'
declare namespace Deno {
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
TSEOF
cat > "$WORK/tsconfig.fn.json" <<JSONEOF
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true, "allowImportingTsExtensions": true, "skipLibCheck": true, "strict": true, "noImplicitAny": false, "baseUrl": "$WREPO",
    "paths": { "https://esm.sh/@supabase/supabase-js@2.49.4": ["node_modules/@supabase/supabase-js"] } },
  "files": ["$WREPO/supabase/functions/logistics-dispatch/index.ts", "$WREPO/supabase/functions/logistics-api/index.ts", "$WREPO/supabase/functions/logistics-notify/index.ts",
            "$WREPO/supabase/functions/logistics-invoice-email/index.ts", "$WREPO/supabase/functions/logistics-billing-run/index.ts", "deno.d.ts"] }
JSONEOF
fn_ok=0
( cd "$REPO" && npx tsc -p "$WORK/tsconfig.fn.json" ) && echo "edge functions type-check: ok" || fn_ok=1

grep -q "ALL E2E CHECKS PASSED" "$WORK/e2e.out" && [ "$errs" = 0 ] && [ "$contract_ok" = 0 ] && [ "$opt_ok" = 0 ] && [ "$fn_ok" = 0 ] && [ "$http_ok" = 0 ]
