export interface BrandTier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  min_revenue: number;
  min_fulfillment_rate: number;
  min_rating: number;
  min_orders: number;
  commission_rate: number;
  payout_days: number;
  visibility_boost: number;
  promo_credits_monthly: number;
  badge_color: string;
  features: string[];
  created_at: string;
}

export interface BrandPerformance {
  id: string;
  vendor_id: string;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  average_rating: number | null;
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  fulfillment_rate: number | null;
  average_delivery_time: number | null;
  conversion_rate: number | null;
  repeat_customer_rate: number | null;
  created_at: string;
}

export interface PromoCredits {
  id: string;
  vendor_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_monthly_grant: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCreditTransaction {
  id: string;
  vendor_id: string;
  amount: number;
  type: 'earn' | 'spend' | 'expire' | 'bonus';
  category: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface SponsoredPlacement {
  id: string;
  vendor_id: string;
  store_id: string | null;
  product_id: string | null;
  placement_type: 'homepage_featured' | 'category_top' | 'search_boost' | 'banner';
  credit_cost: number;
  start_time: string;
  end_time: string;
  impressions: number;
  clicks: number;
  conversions: number;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface AutoCampaign {
  id: string;
  vendor_id: string;
  store_id: string | null;
  campaign_type: 'slow_day_boost' | 'weekend_special' | 'weather_based' | 'inventory_clear';
  trigger_conditions: {
    day_of_week?: number[];
    sales_below?: number;
    inventory_above?: number;
    weather_type?: string;
  };
  action_config: {
    discount_percent?: number;
    boost_visibility?: boolean;
    notification_push?: boolean;
  };
  credit_budget: number;
  credits_used: number;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandBundle {
  id: string;
  name: string;
  description: string | null;
  created_by_vendor_id: string;
  bundle_discount: number;
  status: 'draft' | 'pending' | 'active' | 'expired';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  products?: BrandBundleProduct[];
}

export interface BrandBundleProduct {
  id: string;
  bundle_id: string;
  vendor_id: string;
  product_id: string;
  contribution_discount: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    store_id: string;
  };
  vendor?: {
    id: string;
    business_name: string;
  };
}

export interface CrossPromotion {
  id: string;
  initiator_vendor_id: string;
  partner_vendor_id: string;
  promo_type: 'cross_display' | 'shared_discount' | 'co_campaign';
  terms: {
    discount_split?: number;
    display_duration_days?: number;
    revenue_share?: number;
  };
  status: 'pending' | 'active' | 'completed' | 'declined';
  start_date: string | null;
  end_date: string | null;
  initiator_products: string[];
  partner_products: string[];
  created_at: string;
  updated_at: string;
  initiator_vendor?: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
  partner_vendor?: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
}

export interface BrandImprovementTip {
  id: string;
  vendor_id: string;
  tip_type: 'pricing' | 'inventory' | 'marketing' | 'fulfillment' | 'customer_service';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  action_url: string | null;
  data_context: Record<string, unknown> | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface BrandDashboardStats {
  tier: BrandTier | null;
  performance: BrandPerformance | null;
  promoCredits: PromoCredits | null;
  tips: BrandImprovementTip[];
  nextTierProgress: {
    tier: BrandTier;
    revenueProgress: number;
    fulfillmentProgress: number;
    ratingProgress: number;
    ordersProgress: number;
  } | null;
}
