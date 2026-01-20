
-- Disable RLS temporarily for cleanup
SET session_replication_role = 'replica';

-- Delete auction-related data
DELETE FROM public.auction_bids;
DELETE FROM public.auction_registrations;
DELETE FROM public.auction_status_history;
DELETE FROM public.auction_watchlist;
DELETE FROM public.proxy_bids;
DELETE FROM public.auctions;

-- Delete order-related data
DELETE FROM public.order_history;
DELETE FROM public.order_insurance;
DELETE FROM public.order_items;
DELETE FROM public.delivery_tips;
DELETE FROM public.delivery_earnings;
DELETE FROM public.delivery_jobs;
DELETE FROM public.orders;

-- Delete product-related data
DELETE FROM public.variation_images;
DELETE FROM public.product_variations;
DELETE FROM public.product_images;
DELETE FROM public.downloadable_files;
DELETE FROM public.collection_products;
DELETE FROM public.reviews;
DELETE FROM public.wishlists;
DELETE FROM public.products;
DELETE FROM public.collections;

-- Delete store-related data
DELETE FROM public.store_categories;
DELETE FROM public.stores;

-- Delete vendor-related data
DELETE FROM public.payouts;
DELETE FROM public.vendor_documents;
DELETE FROM public.vendor_notifications;
DELETE FROM public.vendor_payment_methods;
DELETE FROM public.vendor_subscription_features;
DELETE FROM public.vendor_subscription_usage;
DELETE FROM public.vendor_upgrade_triggers;
DELETE FROM public.brand_performance;
DELETE FROM public.brand_tier_history;
DELETE FROM public.brand_improvement_tips;
DELETE FROM public.brand_bundle_products;
DELETE FROM public.brand_bundles;
DELETE FROM public.cross_promotions;
DELETE FROM public.auto_campaigns;
DELETE FROM public.promo_credit_transactions;
DELETE FROM public.promo_credits;
DELETE FROM public.promotions;
DELETE FROM public.sponsored_placements;
DELETE FROM public.import_jobs;
DELETE FROM public.inventory_settings;
DELETE FROM public.vendors;

-- Delete driver-related data
DELETE FROM public.driver_analytics;
DELETE FROM public.driver_cashouts;
DELETE FROM public.driver_investments;
DELETE FROM public.driver_payouts;
DELETE FROM public.driver_performance_stats;
DELETE FROM public.driver_tier_history;
DELETE FROM public.driver_vehicle_fund;
DELETE FROM public.drivers;

-- Delete consumer-related data
DELETE FROM public.consumer_activity_log;
DELETE FROM public.consumer_badges;
DELETE FROM public.consumer_preferences;
DELETE FROM public.consumer_streaks;
DELETE FROM public.flash_deals;

-- Delete UCoin-related data
DELETE FROM public.ucoin_velocity_log;
DELETE FROM public.ucoin_transfer_usage;
DELETE FROM public.ucoin_transactions;
DELETE FROM public.ucoin_wallets;
DELETE FROM public.ucoin_transfer_limits;
DELETE FROM public.ucoin_user_settings;

-- Delete mining-related data
DELETE FROM public.mining_completions;
DELETE FROM public.daily_mining_limits;
DELETE FROM public.social_accounts;
DELETE FROM public.user_affiliate_status;
DELETE FROM public.referral_mining_bonuses;

-- Delete referral-related data
DELETE FROM public.referrals;
DELETE FROM public.user_referral_codes;

-- Delete messaging data
DELETE FROM public.messages;
DELETE FROM public.conversations;

-- Delete support tickets
DELETE FROM public.support_tickets;

-- Delete user-related data
DELETE FROM public.user_addresses;
DELETE FROM public.user_currency_preferences;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- Delete all users from auth
DELETE FROM auth.users;

-- Re-enable RLS
SET session_replication_role = 'origin';
