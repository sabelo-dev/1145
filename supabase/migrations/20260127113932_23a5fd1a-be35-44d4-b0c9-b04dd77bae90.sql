-- Delete user zwidekasabelo@gmail.com and all related data
-- User IDs: b0f3150c-0fa9-4a89-aa1a-6393eb7988bb, e484a91a-958e-40a0-8cd3-bb11b456d7a5, 0718c094-3b2c-467a-a0fb-f8eddc41e0d3

DO $$
DECLARE
  user_ids uuid[] := ARRAY['b0f3150c-0fa9-4a89-aa1a-6393eb7988bb', 'e484a91a-958e-40a0-8cd3-bb11b456d7a5', '0718c094-3b2c-467a-a0fb-f8eddc41e0d3']::uuid[];
BEGIN
  -- Delete from ucoin-related tables
  DELETE FROM ucoin_transactions WHERE user_id = ANY(user_ids);
  DELETE FROM ucoin_wallets WHERE user_id = ANY(user_ids);
  DELETE FROM ucoin_transfer_usage WHERE user_id = ANY(user_ids);
  DELETE FROM ucoin_user_settings WHERE user_id = ANY(user_ids);
  DELETE FROM ucoin_velocity_log WHERE user_id = ANY(user_ids);
  
  -- Delete referral data
  DELETE FROM user_referral_codes WHERE user_id = ANY(user_ids);
  DELETE FROM referrals WHERE referrer_id = ANY(user_ids) OR referred_id = ANY(user_ids);
  DELETE FROM referral_mining_bonuses WHERE beneficiary_id = ANY(user_ids) OR miner_id = ANY(user_ids);
  
  -- Delete mining data
  DELETE FROM mining_completions WHERE user_id = ANY(user_ids);
  DELETE FROM daily_mining_limits WHERE user_id = ANY(user_ids);
  DELETE FROM user_affiliate_status WHERE user_id = ANY(user_ids);
  
  -- Delete social accounts
  DELETE FROM social_accounts WHERE user_id = ANY(user_ids);
  DELETE FROM approved_social_accounts WHERE user_id = ANY(user_ids);
  
  -- Delete consumer-related data
  DELETE FROM consumer_badges WHERE user_id = ANY(user_ids);
  DELETE FROM consumer_streaks WHERE user_id = ANY(user_ids);
  DELETE FROM consumer_preferences WHERE user_id = ANY(user_ids);
  DELETE FROM consumer_activity_log WHERE user_id = ANY(user_ids);
  
  -- Delete auction data
  DELETE FROM auction_bids WHERE user_id = ANY(user_ids);
  DELETE FROM auction_registrations WHERE user_id = ANY(user_ids);
  DELETE FROM auction_watchlist WHERE user_id = ANY(user_ids);
  DELETE FROM proxy_bids WHERE user_id = ANY(user_ids);
  
  -- Delete wishlist and reviews
  DELETE FROM wishlists WHERE user_id = ANY(user_ids);
  DELETE FROM reviews WHERE user_id = ANY(user_ids);
  
  -- Delete addresses
  DELETE FROM user_addresses WHERE user_id = ANY(user_ids);
  
  -- Delete user currency preferences
  DELETE FROM user_currency_preferences WHERE user_id = ANY(user_ids);
  
  -- Delete user roles
  DELETE FROM user_roles WHERE user_id = ANY(user_ids);
  
  -- Delete influencer profiles
  DELETE FROM influencer_profiles WHERE user_id = ANY(user_ids);
  
  -- Delete profiles (all 3 orphaned/real)
  DELETE FROM profiles WHERE id = ANY(user_ids);
  
  -- Delete the auth.users record (only one exists: 0718c094-3b2c-467a-a0fb-f8eddc41e0d3)
  -- We need to bypass FK constraints
  SET session_replication_role = replica;
  
  DELETE FROM auth.mfa_factors WHERE user_id = '0718c094-3b2c-467a-a0fb-f8eddc41e0d3';
  DELETE FROM auth.sessions WHERE user_id = '0718c094-3b2c-467a-a0fb-f8eddc41e0d3';
  DELETE FROM auth.refresh_tokens WHERE user_id = '0718c094-3b2c-467a-a0fb-f8eddc41e0d3';
  DELETE FROM auth.identities WHERE user_id = '0718c094-3b2c-467a-a0fb-f8eddc41e0d3';
  DELETE FROM auth.users WHERE id = '0718c094-3b2c-467a-a0fb-f8eddc41e0d3';
  
  SET session_replication_role = DEFAULT;
END $$;