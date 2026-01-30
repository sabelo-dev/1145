export interface SocialMediaPost {
  id: string;
  created_by: string;
  title: string;
  content: string;
  content_type: 'plain' | 'product' | 'news' | 'promo' | 'announcement';
  product_id?: string;
  media_urls: string[];
  platforms: string[];
  scheduled_at?: string;
  published_at?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  external_post_ids: Record<string, string>;
  external_post_url?: string;
  engagement_stats: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ApprovedSocialAccount {
  id: string;
  user_id: string;
  platform: string;
  account_handle: string;
  account_url?: string;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InfluencerProfile {
  id: string;
  user_id: string;
  display_name?: string;
  username?: string;
  bio?: string;
  assigned_by?: string;
  can_post: boolean;
  can_schedule: boolean;
  can_manage_accounts: boolean;
  platforms_access: string[];
  performance_stats: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialPostPlatform {
  id: string;
  post_id: string;
  platform: string;
  external_post_id?: string;
  external_post_url?: string;
  status: 'pending' | 'published' | 'failed';
  error_message?: string;
  published_at?: string;
  created_at: string;
}

export type ContentType = 'plain' | 'product' | 'news' | 'promo' | 'announcement';

export const SOCIAL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: 'Instagram', color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', icon: 'Facebook', color: '#1877F2' },
  { id: 'twitter', name: 'X (Twitter)', icon: 'Twitter', color: '#000000' },
  { id: 'tiktok', name: 'TikTok', icon: 'Music', color: '#000000' },
  { id: 'youtube', name: 'YouTube', icon: 'Youtube', color: '#FF0000' },
] as const;

export const CONTENT_TYPES = [
  { id: 'plain', name: 'Plain Content', description: 'General text and media post' },
  { id: 'product', name: 'Product Promotion', description: 'Share a product with direct link' },
  { id: 'news', name: 'Platform News', description: 'Announcements and updates' },
  { id: 'promo', name: 'Promotional', description: 'Sales, discounts, and offers' },
  { id: 'announcement', name: 'Announcement', description: 'Important platform announcements' },
] as const;
