export interface ConsumerPreferences {
  id: string;
  user_id: string;
  preferred_categories: string[];
  preferred_vendors: string[];
  default_location: {
    latitude?: number;
    longitude?: number;
    city?: string;
    province?: string;
  } | null;
  notification_preferences: {
    flash_deals: boolean;
    streak_reminders: boolean;
    nearby_deals: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ConsumerStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_order_week: string | null;
  streak_start_date: string | null;
  total_weeks_ordered: number;
  created_at: string;
  updated_at: string;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  category: 'loyalty' | 'social' | 'spending' | 'special';
  requirement_type: 'orders' | 'spending' | 'streak' | 'referrals' | 'reviews' | 'local_orders';
  requirement_value: number;
  ucoin_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface ConsumerBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_featured: boolean;
  badge?: BadgeDefinition;
}

export interface FlashDeal {
  id: string;
  store_id: string | null;
  product_id: string | null;
  title: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed' | 'flash_price';
  discount_value: number;
  original_price: number | null;
  flash_price: number | null;
  stock_limit: number | null;
  claimed_count: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    slug: string;
    store_id: string;
  };
  store?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export interface OrderInsurance {
  id: string;
  order_id: string;
  user_id: string;
  ucoin_cost: number;
  coverage_type: 'full' | 'partial' | 'delay';
  coverage_amount: number;
  status: 'active' | 'claimed' | 'expired' | 'refunded';
  claim_reason: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface ConsumerActivityLog {
  id: string;
  user_id: string;
  activity_type: 'view' | 'search' | 'cart_add' | 'purchase' | 'wishlist';
  category: string | null;
  product_id: string | null;
  store_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RetentionStats {
  streakData: ConsumerStreak | null;
  badgesEarned: number;
  totalBadges: number;
  nextBadgeProgress: {
    badge: BadgeDefinition;
    currentValue: number;
    percentComplete: number;
  } | null;
}
