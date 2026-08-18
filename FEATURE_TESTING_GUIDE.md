# Feature Testing Guide

## 1. Newsletter Subscription Flow

### Test Case 1.1: Valid Email Subscription
- **Setup**: Navigate to any storefront with email capture enabled
- **Steps**:
  1. Scroll to newsletter section at bottom of page
  2. Enter valid email (e.g., test@example.com)
  3. Click subscribe button
- **Expected**:
  - Email is submitted to backend
  - Success toast appears: "Successfully subscribed to our newsletter!"
  - Subscribe form disappears, shows "You're subscribed!" message
  - Verify data persisted in `newsletter_subscribers` table:
    - Email should be normalized to lowercase
    - Status should be 'active'
    - Store ID should match current storefront

### Test Case 1.2: Invalid Email Format
- **Steps**:
  1. Enter invalid email (e.g., "notanemail" or "test@")
  2. Click subscribe
- **Expected**:
  - Error message: "Please enter a valid email address"
  - Email not submitted to backend
  - Form remains available for retry

### Test Case 1.3: Duplicate Subscription Prevention
- **Setup**: Email already exists in newsletter_subscribers for this store
- **Steps**:
  1. Enter same email again
  2. Click subscribe
- **Expected**:
  - Subscription completes (upsert behavior)
  - Form shows success state
  - Only one subscription record exists in database
  - Status remains 'active', subscribed_at updated to current time

### Test Case 1.4: Empty Email Field
- **Steps**:
  1. Leave email field empty
  2. Click subscribe
- **Expected**:
  - Error message: "Please enter an email address"
  - No API call made

### Test Case 1.5: Cross-browser Keyboard Submit
- **Steps**:
  1. Enter valid email
  2. Press Enter key instead of clicking button
- **Expected**:
  - Email submitted successfully
  - Same success behavior as clicking button

**Database Verification**:
```sql
-- Verify newsletter subscribers table
SELECT email, store_id, status, subscribed_at 
FROM newsletter_subscribers 
WHERE email = 'test@example.com' 
ORDER BY subscribed_at DESC LIMIT 1;
```

---

## 2. UCoin Mining System

### Test Case 2.1: Task Creation by Admin
- **Setup**: Access admin dashboard, Mining Tasks section
- **Steps**:
  1. Click "Add Task" button
  2. Fill in: Title, Task Type (slug), Category, Description, Base Reward (e.g., 10), Cooldown (24h)
  3. Click "Add Task"
- **Expected**:
  - Task created successfully
  - Toast shows: "Task added successfully"
  - New task appears in tasks list
  - Task is_active = true
  - Task appears in SocialMiningDashboard

### Test Case 2.2: Task Completion Auto-Verification
- **Setup**: User logged in, mining task available
- **Steps**:
  1. Navigate to UCoin Mining page
  2. Click "Complete" on any task
- **Expected**:
  - Task marked as completed immediately
  - Toast shows: "Task Completed! 🎉" with UCoin reward amount
  - Status in UI updates
  - Database verification:
    - `mining_completions` record created with status='paid'
    - User's UCoin balance increased
    - `daily_mining_limits` updated

### Test Case 2.3: Daily Mining Limit Enforcement
- **Setup**: User has completed tasks and reached their daily limit
- **Steps**:
  1. Try to complete another task after reaching daily cap
  2. Click "Complete"
- **Expected**:
  - Error toast: "Daily mining limit reached"
  - Task not completed
  - User unable to earn more UCoin until next day
  - `daily_mining_limits` table shows remaining=0

### Test Case 2.4: Max Daily Completions Per Task
- **Setup**: Task with max_daily_completions=1, user tries to complete twice in same day
- **Steps**:
  1. Complete task (success)
  2. Try to complete same task again
  3. Click "Complete"
- **Expected**:
  - First completion succeeds, "Task Completed!"
  - Second attempt shows error: "Maximum daily completions for this task reached"
  - Only 1 reward credited

### Test Case 2.5: Idempotency Protection (Duplicate Submission)
- **Setup**: Complete a mining task, attempt to submit duplicate completion
- **Steps**:
  1. Complete task
  2. Simulate duplicate completion by:
     - Resend same completion request via API
     - OR rapidly click complete button multiple times (network debounce)
- **Expected**:
  - First completion processes normally
  - Duplicate submission rejected by idempotency constraint
  - User still only receives single reward
  - No duplicate UCoin credit
  - Database shows single completion record

### Test Case 2.6: Affiliate Tier Multiplier Applied
- **Setup**: User with 1.5x mining multiplier tier
- **Steps**:
  1. Complete task with base_reward=10
  2. User has affiliate_tier.mining_multiplier=1.5
- **Expected**:
  - Final reward = 10 * 1.5 = 15 UCoin
  - Completion record shows: base_reward=10, multiplier=1.5, final_reward=15
  - User's wallet shows +15 UCoin

### Test Case 2.7: Task Inactive Status
- **Setup**: Task with is_active=false
- **Steps**:
  1. Try to view/complete inactive task
- **Expected**:
  - Task not displayed in available tasks list
  - If forced completion API call: "Task not found or inactive" error

**Database Verification**:
```sql
-- Verify mining completion
SELECT id, user_id, task_id, status, final_reward, verified_at 
FROM mining_completions 
WHERE user_id = 'USER_ID' 
ORDER BY created_at DESC LIMIT 5;

-- Verify daily limits
SELECT user_id, mining_date, total_mined, tasks_completed, remaining
FROM daily_mining_limits 
WHERE user_id = 'USER_ID' AND mining_date = CURRENT_DATE;

-- Verify no duplicates
SELECT COUNT(*) as duplicate_count, task_id 
FROM mining_completions 
WHERE user_id = 'USER_ID' AND created_at::date = CURRENT_DATE 
GROUP BY task_id 
HAVING COUNT(*) > 1;
```

---

## 3. Payment Methods - Linked Cards

### Test Case 3.1: View Linked Cards
- **Setup**: User with linked payment cards via PayFast
- **Steps**:
  1. Navigate to Wallet page
  2. Click "Cards" tab
- **Expected**:
  - All linked cards displayed in grid
  - Each card shows:
    - Credit Card icon
    - Brand (VISA, MASTERCARD, etc.)
    - Last 4 digits
    - Expiry date
    - Status badge (Active/Expired/Pending)
    - Remove button

### Test Case 3.2: Add New Card
- **Setup**: User on Cards tab, no cards linked yet
- **Steps**:
  1. Click "Add card" button
  2. Redirected to PayFast card linking flow
  3. Complete card entry (use test card 4532 0151 3010 8020)
- **Expected**:
  - PayFast form submits successfully
  - Callback returns to FintechPage
  - New card appears in cards list
  - Card status initially 'pending' or 'active'

### Test Case 3.3: Remove Card
- **Setup**: User with linked card
- **Steps**:
  1. Click trash icon on card
  2. Confirm removal (if prompted)
- **Expected**:
  - Card removed from display
  - Toast: "Card removed"
  - Database updated: card status changed or marked for deletion
  - Card no longer available for deposits

### Test Case 3.4: Empty State
- **Setup**: User with no linked cards
- **Steps**:
  1. Navigate to Wallet > Cards
- **Expected**:
  - Empty state message displays:
    "No cards linked yet. Add one to fund deposits and pay faster."
  - "Add card" button prominent and clickable

### Test Case 3.5: Card Status Display
- **Setup**: Multiple cards with different statuses
- **Steps**:
  1. View cards in Cards tab
- **Expected**:
  - Active cards: green badge with checkmark
  - Expired cards: red badge with X
  - Pending cards: yellow badge with clock
  - Statuses match data in fintech backend

**Database Verification**:
```sql
-- Verify linked cards (stored in fintech system, not directly in Supabase)
-- Check card linking log or audit trail for card creation events
SELECT user_id, brand, last4, status, verified_at 
FROM payment_cards 
WHERE user_id = 'USER_ID' 
ORDER BY created_at DESC;
```

---

## 4. Subscription Upgrade Flow

### Test Case 4.1: Open Plan Selection Modal
- **Setup**: Merchant/vendor dashboard
- **Steps**:
  1. Navigate to Subscription page
  2. Click "Upgrade Plan" or similar CTA
  3. "Choose Your Plan" modal opens
- **Expected**:
  - Modal displays 4 plan cards (Starter, Bronze, Silver, Gold)
  - Only "Quick View" content shown (no Full Comparison tab)
  - Current tier highlighted with ring
  - Pricing displayed based on selected billing (Monthly/Yearly)

### Test Case 4.2: Toggle Billing Period
- **Setup**: Plan selector modal open
- **Steps**:
  1. Click Monthly/Yearly toggle
- **Expected**:
  - All prices update immediately
  - "Save ~17%" badge appears for Yearly
  - Toggle state persists while modal is open

### Test Case 4.3: Select Plan (Upgrade)
- **Setup**: Current tier = Starter, selecting Bronze
- **Steps**:
  1. Click "Upgrade" button on Bronze plan
  2. Complete payment flow
- **Expected**:
  - Modal closes
  - Subscription updated to Bronze
  - Features immediately available:
    - 100 product listings (vs 25)
    - 5 promotions/month
    - 9% commission (vs 10%)
    - R100 ad credits

### Test Case 4.4: Select Plan (Downgrade)
- **Setup**: Current tier = Silver, selecting Bronze
- **Steps**:
  1. Click "Downgrade" button on Bronze
  2. Downgrade confirmation dialog appears
- **Expected**:
  - Warning dialog: "Downgrade to Bronze?"
  - Explanation of lost benefits
  - User can confirm or cancel
  - On confirm: tier downgraded, excess products archived

### Test Case 4.5: Current Plan Button Disabled
- **Setup**: User viewing current plan
- **Steps**:
  1. Look at current tier card
- **Expected**:
  - Button shows "Current"
  - Button is disabled (greyed out)
  - Cannot click to re-select

### Test Case 4.6: Plan Comparison Removed
- **Setup**: Open plan selector modal
- **Steps**:
  1. Check for tabs
- **Expected**:
  - NO "Full Comparison" tab visible
  - NO comparison table shown
  - Only plan cards and billing toggle displayed

**Database Verification**:
```sql
-- Verify subscription upgrade
SELECT id, subscription_tier, subscription_next_billing_date, subscription_auto_renew, updated_at
FROM vendors 
WHERE user_id = 'USER_ID' 
ORDER BY updated_at DESC LIMIT 1;
```

---

## 5. Integration Tests

### Test Case 5.1: Newsletter → Fintech Flow
- **Steps**:
  1. Subscribe to newsletter
  2. Complete purchase via cards
  3. Verify both systems interact properly
- **Expected**:
  - Newsletter signup doesn't interfere with payment flow
  - User data consistent across systems

### Test Case 5.2: Mining → Subscription Interaction
- **Steps**:
  1. Earn UCoin from mining
  2. Check if UCoin affects subscription eligibility
- **Expected**:
  - Mining rewards independent from subscription tier
  - Both systems function independently

### Test Case 5.3: Multi-storefront Newsletter Isolation
- **Steps**:
  1. Subscribe to newsletter on Store A
  2. Subscribe with same email on Store B
- **Expected**:
  - Two separate subscription records created
  - Each store has independent subscriber list
  - UNIQUE(email, store_id) constraint enforced

---

## 6. Performance Tests

### Test Case 6.1: Newsletter Subscription under Load
- **Setup**: Simulate 100 concurrent subscriptions
- **Expected**:
  - All emails properly captured
  - No duplicate entries created
  - Response time < 2 seconds per subscription
  - Database constraints prevent duplicates

### Test Case 6.2: Mining Task Completion Rate
- **Steps**:
  1. Have 50 users complete same task
  2. Measure task completion time
- **Expected**:
  - All completions process < 1 second
  - Daily limits enforced correctly
  - Multipliers applied accurately
  - No race conditions with idempotency key

---

## 7. Security Tests

### Test Case 7.1: SQL Injection - Newsletter
- **Steps**:
  1. Enter email with SQL: `test'; DROP TABLE newsletter_subscribers; --`
- **Expected**:
  - Input treated as plain text
  - Error: invalid email format
  - Database unaffected

### Test Case 7.2: Unauthorized Mining Completion
- **Setup**: Logged out or different user
- **Steps**:
  1. Try to call complete_mining_task for another user
- **Expected**:
  - Permission denied
  - Completion not created
  - Error returned

### Test Case 7.3: Subscription Downgrade without Payment
- **Steps**:
  1. Current tier = Silver (paid)
  2. Try to downgrade without processing refund
- **Expected**:
  - System enforces refund/credit processing
  - Cannot proceed without proper payment handling

---

## 8. Regression Tests (Existing Features)

### Test Case 8.1: Product Listing (not affected)
- **Expected**: No regression in product catalog display

### Test Case 8.2: Order Processing (not affected)
- **Expected**: Order flow unchanged by new features

### Test Case 8.3: Authentication (not affected)
- **Expected**: Login/logout flows work as before

---

## Testing Checklist

- [ ] All 5 newsletter scenarios pass
- [ ] All 7 mining scenarios pass
- [ ] All 5 payment card scenarios pass
- [ ] All 6 subscription scenarios pass
- [ ] All 3 integration tests pass
- [ ] Performance benchmarks within limits
- [ ] Security tests all fail gracefully
- [ ] No regressions in existing features
- [ ] Mobile viewport tests passed
- [ ] Database consistency verified
- [ ] Error messages clear and actionable
- [ ] Toast notifications display correctly
- [ ] Loading states show appropriately
- [ ] Empty states render properly
- [ ] Accessibility compliance checked (WCAG 2.1 AA)

---

## Post-Launch Monitoring

### Metrics to Track
1. **Newsletter**:
   - Subscription success rate
   - Duplicate subscription attempts
   - Email validation error rate

2. **Mining**:
   - Daily active miners
   - Average reward per user
   - Daily limit hit rate
   - Completion-to-credit latency

3. **Payments**:
   - Card linking success rate
   - Card removal rate
   - Payment failure rate

4. **Subscriptions**:
   - Upgrade conversion rate
   - Downgrade rate
   - Plan tier distribution

### Error Logging
- Monitor application logs for any mining task failures
- Track newsletter subscription errors
- Monitor payment processing failures
- Log subscription plan change issues

### Database Backups
- Ensure daily backups before each feature goes live
- Test backup restoration
- Keep transaction logs for at least 30 days
