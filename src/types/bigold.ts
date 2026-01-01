export interface BiGoldWallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  created_at: string;
  updated_at: string;
}

export interface BiGoldTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'earn' | 'spend';
  category: string;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface BiGoldEarningRule {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface BiGoldSpendingOption {
  id: string;
  category: string;
  cost: number;
  value: number;
  value_type: 'percentage' | 'fixed' | 'boost';
  description: string | null;
  is_active: boolean;
  min_balance: number;
  user_types: string[];
  created_at: string;
  updated_at: string;
}

export type EarningCategory =
  | 'order_completed'
  | 'delivery_completed'
  | 'review_submitted'
  | 'referral_signup'
  | 'referral_purchase'
  | 'ontime_delivery'
  | 'sales_milestone_100'
  | 'sales_milestone_500'
  | 'sales_milestone_1000'
  | 'daily_login'
  | 'profile_complete';

export type SpendingCategory =
  | 'discount_5_percent'
  | 'discount_10_percent'
  | 'free_delivery'
  | 'delivery_discount'
  | 'ad_boost_basic'
  | 'ad_boost_premium'
  | 'priority_listing'
  | 'cashout_driver'
  | 'cashout_vendor';
