export interface UCoinWallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  gold_balance_mg?: number;
  created_at: string;
  updated_at: string;
}

export interface UCoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'earn' | 'spend';
  category: string;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  sender_id?: string | null;
  recipient_id?: string | null;
  transfer_fee_mg?: number;
  transfer_reference?: string | null;
  created_at: string;
}

export interface UCoinEarningRule {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface UCoinSpendingOption {
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

export interface UCoinTransferLimits {
  daily_limit_mg: number;
  monthly_limit_mg: number;
  single_transfer_max_mg: number;
  min_transfer_mg: number;
  requires_2fa_above_mg: number;
  daily_used_mg: number;
  monthly_used_mg: number;
  remaining_daily_mg: number;
  remaining_monthly_mg: number;
}

export interface UCoinUserSettings {
  id: string;
  user_id: string;
  user_tier: 'standard' | 'premium' | 'verified';
  is_transfer_enabled: boolean;
  requires_2fa: boolean;
  display_mode: 'ucoin' | 'gold' | 'currency';
  preferred_gold_unit: 'mg' | 'g' | 'oz';
  created_at: string;
  updated_at: string;
}

export interface UCoinTransfer {
  id: string;
  amount: number;
  type: string;
  direction: 'sent' | 'received';
  counterparty_id: string | null;
  transfer_reference: string | null;
  note: string | null;
  fee_mg: number;
  created_at: string;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  transfer_reference?: string;
  amount?: number;
  fee?: number;
  sender_new_balance?: number;
  recipient_id?: string;
}

// UCoin is gold-backed: 1 UCoin = 1 mg of gold (mgAu)
export const UCOIN_GOLD_RATIO = {
  MG_PER_UCOIN: 1,
  UCOIN_PER_MG: 1,
  UCOIN_PER_GRAM: 1000,
  UCOIN_PER_OZ: 31103.4768, // Troy ounce
} as const;

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
  | 'profile_complete'
  | 'social_mining'
  | 'referral_mining_bonus'
  | 'p2p_transfer_received';

export type SpendingCategory =
  | 'discount_5_percent'
  | 'discount_10_percent'
  | 'free_delivery'
  | 'delivery_discount'
  | 'ad_boost_basic'
  | 'ad_boost_premium'
  | 'priority_listing'
  | 'cashout_driver'
  | 'cashout_vendor'
  | 'p2p_transfer_sent';

// Display mode types
export type UCoinDisplayMode = 'ucoin' | 'gold' | 'currency';
export type GoldUnit = 'mg' | 'g' | 'oz';
