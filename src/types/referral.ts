export interface UserReferralCode {
  id: string;
  user_id: string;
  code: string;
  uses_count: number;
  total_earned: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  status: 'pending' | 'signup_completed' | 'purchase_completed' | 'expired';
  signup_reward_paid: boolean;
  purchase_reward_paid: boolean;
  first_purchase_amount: number | null;
  first_purchase_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  referred_profile?: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface ReferralStats {
  totalReferrals: number;
  signupsCompleted: number;
  purchasesCompleted: number;
  totalEarned: number;
  pendingEarnings: number;
}
