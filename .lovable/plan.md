# UCoin Mining & Validation System

Rebuild UCoin rewards around Proof-of-Action: no coins credited until an action is fully completed, validated, fraud-checked, deduped, and recorded in an append-only ledger. Existing `award_ucoin` shortcut paths (order completed, review submitted, mining tasks, referrals) are replaced by an event-driven pipeline.

## Scope of this plan
End-to-end backend + minimal user/admin UI. Activities covered in first release: Daily Login, Purchase, Referral, Delivery, Review, Social Share, Video Watch, KYC/Registration. Others (surveys, community, bug reports) plug into the same framework later via config.

## Data model (new tables)

```text
mining_activities         config: code, display_name, reward, evidence_schema,
                          rules (jsonb), cooldown, daily_cap, requires_moderation,
                          auto_expire_hours, is_active
mining_requests           lifecycle rows: user_id, activity_code, status
                          (pending|validating|awaiting_verification|approved|
                          rejected|expired|failed|credited|reversed),
                          reward_mg, fraud_score, evidence jsonb, metadata jsonb,
                          reference_type, reference_id, idempotency_key UNIQUE,
                          started_at, validated_at, credited_at, validator,
                          rejection_reason
mining_events             append-only event log per request (stage, actor, payload)
mining_evidence           optional file/proof rows linked to request
ucoin_ledger              append-only: request_id, user_id, delta_mg, kind
                          (credit|reversal|adjustment), running_balance, created_at
ucoin_reversals           reason, original_request_id, admin_id
fraud_signals             per-request signals (device, ip, vpn, velocity, graph)
mining_queue_jobs         backing table for async workers (status, attempts,
                          next_run_at, locked_by)
```

Wallet balance in `ucoin_wallets.balance` becomes a cached projection of `ucoin_ledger`; a `refresh_wallet_from_ledger(user_id)` function recalculates on demand.

## Pipeline

```text
emit_action(activity, evidence, idempotency_key)
   -> insert mining_requests (pending) + mining_events(started)
   -> enqueue mining_queue_jobs
worker:
   -> validating: run activity rules engine (JSON DSL in mining_activities.rules)
   -> awaiting_verification: if activity needs external confirmation
      (purchase delivered + return window, referral first purchase, etc.)
   -> fraud scoring: compute fraud_score from fraud_signals + rules
   -> dedupe: reject if (user_id, activity_code, reference) already credited
   -> moderation: create review task if flagged
   -> approved -> credit: insert ucoin_ledger row + update wallet in txn
   -> notification: user_notifications row
```

All state transitions write a row to `mining_events`. Failed/expired terminal states never credit.

## Activity rules (initial set)

- **daily_login**: 1/day per user, requires trusted device, 24h cooldown
- **purchase**: awaits order.status=delivered AND now > delivered_at + return_window (7d), no refund
- **referral**: awaits referee email+phone verified, KYC passed, first order delivered + return window
- **delivery**: awaits driver POD (OTP + photo + rating >= 3), GPS route sanity
- **review**: awaits verified_purchase + moderation.approved + min 20 words + not-duplicate hash
- **social_share**: awaits tracked link click from unique device with dwell > 10s, no bot UA
- **video_watch**: awaits >=95% watched + quiz passed if configured
- **kyc_complete**: awaits kyc.status=verified

Reward amounts, cooldowns, and caps live in `mining_activities` so business can tune without deploys.

## Server code

`supabase/functions/ucoin-mining/` (single function, action-routed):
- `POST /emit` — accepts `{activity, evidence, idempotency_key, reference}`; validates JWT; inserts request; enqueues job. Idempotent.
- `POST /worker/tick` — drains queue (cron every minute via pg_cron + pg_net).
- `POST /admin/decision` — approve/reject flagged requests (admin only).
- `POST /admin/reverse` — reversal writing negative ledger row.
- Shared rules engine module evaluates JSON rules with helpers (`orderDelivered`, `returnWindowClosed`, `hasVerifiedPurchase`, `fraudScore`, `dedupeKey`).

Fraud scoring helper combines: account age, device fingerprint reuse, IP/VPN, action velocity, referral graph loops, GPS/OTP mismatch.

## Trigger migration

Existing triggers (`trigger_ucoin_order_completed`, `trigger_ucoin_review_submitted`, `complete_mining_task` direct-credit path, referral direct credits) are rewritten to call `emit_action` instead of `award_ucoin`. `award_ucoin` becomes internal-only, called exclusively by the credit step after approval. Historical `ucoin_transactions` rows are preserved; new activity flows through the ledger.

## UI

**User dashboard** (`/wallet/mining`):
- List of mining_requests with status pill, reward, started/validated/credited timestamps, rejection reason, reference link.
- Filter by activity + status. Empty states + explanations.

**Admin dashboard** (`/admin/ucoin/mining`):
- Queue health (pending/validating/awaiting counts, oldest age).
- Review queue for flagged requests: evidence viewer, fraud score, approve/reject with reason.
- Reversal tool with reason picker.
- Activity config editor (reward, cooldown, cap, rules toggle) writing to `mining_activities`.
- Export CSV.

Small user-facing notifications: "You earned N UCoin — Verified Purchase" / "Mining request rejected — Duplicate referral".

## Security

- RLS: users read only their own `mining_requests` / `ucoin_ledger`; admins full via `has_role`.
- `emit_action` requires authenticated JWT; edge function verifies user matches.
- Ledger table is insert-only for `authenticated` (via SECURITY DEFINER), no update/delete.
- Idempotency key UNIQUE prevents replay.

## Rollout

1. Migrations: tables, indexes, RLS, seed `mining_activities` config, cron schedule.
2. Edge function `ucoin-mining` + rules engine module.
3. Replace direct-credit triggers with `emit_action` calls.
4. User `/wallet/mining` page + link from wallet.
5. Admin `/admin/ucoin/mining` with queue, review, reversal, config.
6. Backfill: leave historical `ucoin_transactions`; new activity starts fresh.

## Out of scope (future, per spec §25)
Reputation multipliers, staking, achievements, seasonal campaigns, ML anomaly detection, governance voting — architecture leaves hooks (multiplier column on request, campaign_id already on completions) but no UI in v1.

## Acceptance
- No path credits wallet without a preceding `mining_requests.status='approved'` and matching `ucoin_ledger` row.
- Wallet balance == SUM(ucoin_ledger.delta_mg) for every user.
- Every request has ≥1 `mining_events` row per stage transition.
- Duplicate `idempotency_key` returns the original request, never a second credit.
- Refund on a purchase produces a reversal ledger row and status=`reversed`.
