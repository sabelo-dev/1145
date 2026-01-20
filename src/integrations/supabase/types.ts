export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      affiliate_tiers: {
        Row: {
          badge_color: string | null
          badge_icon: string | null
          created_at: string
          daily_mining_cap: number
          display_name: string
          features: Json | null
          id: string
          level: number
          min_conversions: number
          mining_multiplier: number
          name: string
        }
        Insert: {
          badge_color?: string | null
          badge_icon?: string | null
          created_at?: string
          daily_mining_cap?: number
          display_name: string
          features?: Json | null
          id?: string
          level: number
          min_conversions?: number
          mining_multiplier?: number
          name: string
        }
        Update: {
          badge_color?: string | null
          badge_icon?: string | null
          created_at?: string
          daily_mining_cap?: number
          display_name?: string
          features?: Json | null
          id?: string
          level?: number
          min_conversions?: number
          mining_multiplier?: number
          name?: string
        }
        Relationships: []
      }
      attribute_types: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      attribute_values: {
        Row: {
          attribute_type_id: string
          color_hex: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string | null
          updated_at: string
          value: string
        }
        Insert: {
          attribute_type_id: string
          color_hex?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          attribute_type_id?: string
          color_hex?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_values_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "attribute_types"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_registrations: {
        Row: {
          auction_id: string
          created_at: string
          deposit_applied: boolean | null
          id: string
          is_winner: boolean | null
          payment_status: string
          registration_fee_paid: number
          user_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          deposit_applied?: boolean | null
          id?: string
          is_winner?: boolean | null
          payment_status?: string
          registration_fee_paid: number
          user_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          deposit_applied?: boolean | null
          id?: string
          is_winner?: boolean | null
          payment_status?: string
          registration_fee_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_registrations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_status_history: {
        Row: {
          auction_id: string
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
        }
        Insert: {
          auction_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          auction_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_status_history_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_watchlist: {
        Row: {
          auction_id: string
          created_at: string
          id: string
          notify_on_bid: boolean | null
          notify_on_ending: boolean | null
          user_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          id?: string
          notify_on_bid?: boolean | null
          notify_on_ending?: boolean | null
          user_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          id?: string
          notify_on_bid?: boolean | null
          notify_on_ending?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_watchlist_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          bid_increment: number | null
          created_at: string
          current_bid: number | null
          end_date: string | null
          id: string
          product_id: string
          registration_fee: number | null
          start_date: string | null
          starting_bid_price: number | null
          status: string
          updated_at: string
          vendor_base_amount: number
          winner_id: string | null
          winning_bid: number | null
        }
        Insert: {
          bid_increment?: number | null
          created_at?: string
          current_bid?: number | null
          end_date?: string | null
          id?: string
          product_id: string
          registration_fee?: number | null
          start_date?: string | null
          starting_bid_price?: number | null
          status?: string
          updated_at?: string
          vendor_base_amount: number
          winner_id?: string | null
          winning_bid?: number | null
        }
        Update: {
          bid_increment?: number | null
          created_at?: string
          current_bid?: number | null
          end_date?: string | null
          id?: string
          product_id?: string
          registration_fee?: number | null
          start_date?: string | null
          starting_bid_price?: number | null
          status?: string
          updated_at?: string
          vendor_base_amount?: number
          winner_id?: string | null
          winning_bid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_campaigns: {
        Row: {
          action_config: Json
          campaign_type: string
          created_at: string
          credit_budget: number
          credits_used: number
          id: string
          is_active: boolean
          last_triggered: string | null
          store_id: string | null
          trigger_conditions: Json
          trigger_count: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          action_config: Json
          campaign_type: string
          created_at?: string
          credit_budget?: number
          credits_used?: number
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          store_id?: string | null
          trigger_conditions: Json
          trigger_count?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          action_config?: Json
          campaign_type?: string
          created_at?: string
          credit_budget?: number
          credits_used?: number
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          store_id?: string | null
          trigger_conditions?: Json
          trigger_count?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_campaigns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          icon: string
          id: string
          is_active: boolean
          name: string
          requirement_type: string
          requirement_value: number
          ucoin_reward: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          requirement_type: string
          requirement_value: number
          ucoin_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          requirement_type?: string
          requirement_value?: number
          ucoin_reward?: number
        }
        Relationships: []
      }
      brand_bundle_products: {
        Row: {
          bundle_id: string
          contribution_discount: number
          created_at: string
          id: string
          product_id: string
          status: string
          vendor_id: string
        }
        Insert: {
          bundle_id: string
          contribution_discount?: number
          created_at?: string
          id?: string
          product_id: string
          status?: string
          vendor_id: string
        }
        Update: {
          bundle_id?: string
          contribution_discount?: number
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_bundle_products_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "brand_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_bundle_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_bundle_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_bundles: {
        Row: {
          bundle_discount: number
          created_at: string
          created_by_vendor_id: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bundle_discount?: number
          created_at?: string
          created_by_vendor_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bundle_discount?: number
          created_at?: string
          created_by_vendor_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_bundles_created_by_vendor_id_fkey"
            columns: ["created_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_improvement_tips: {
        Row: {
          action_url: string | null
          created_at: string
          data_context: Json | null
          description: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          priority: string
          tip_type: string
          title: string
          vendor_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          data_context?: Json | null
          description: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          priority?: string
          tip_type: string
          title: string
          vendor_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          data_context?: Json | null
          description?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          priority?: string
          tip_type?: string
          title?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_improvement_tips_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_performance: {
        Row: {
          average_delivery_time: number | null
          average_rating: number | null
          cancelled_orders: number
          completed_orders: number
          conversion_rate: number | null
          created_at: string
          fulfillment_rate: number | null
          id: string
          negative_reviews: number
          period_end: string
          period_start: string
          positive_reviews: number
          repeat_customer_rate: number | null
          returned_orders: number
          total_orders: number
          total_revenue: number
          total_reviews: number
          vendor_id: string
        }
        Insert: {
          average_delivery_time?: number | null
          average_rating?: number | null
          cancelled_orders?: number
          completed_orders?: number
          conversion_rate?: number | null
          created_at?: string
          fulfillment_rate?: number | null
          id?: string
          negative_reviews?: number
          period_end: string
          period_start: string
          positive_reviews?: number
          repeat_customer_rate?: number | null
          returned_orders?: number
          total_orders?: number
          total_revenue?: number
          total_reviews?: number
          vendor_id: string
        }
        Update: {
          average_delivery_time?: number | null
          average_rating?: number | null
          cancelled_orders?: number
          completed_orders?: number
          conversion_rate?: number | null
          created_at?: string
          fulfillment_rate?: number | null
          id?: string
          negative_reviews?: number
          period_end?: string
          period_start?: string
          positive_reviews?: number
          repeat_customer_rate?: number | null
          returned_orders?: number
          total_orders?: number
          total_revenue?: number
          total_reviews?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_performance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_tier_history: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          previous_tier_id: string | null
          reason: string | null
          tier_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          previous_tier_id?: string | null
          reason?: string | null
          tier_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          previous_tier_id?: string | null
          reason?: string | null
          tier_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_tier_history_previous_tier_id_fkey"
            columns: ["previous_tier_id"]
            isOneToOne: false
            referencedRelation: "brand_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tier_history_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "brand_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tier_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_tiers: {
        Row: {
          badge_color: string
          commission_rate: number
          created_at: string
          display_name: string
          features: Json
          id: string
          level: number
          min_fulfillment_rate: number
          min_orders: number
          min_rating: number
          min_revenue: number
          name: string
          payout_days: number
          promo_credits_monthly: number
          visibility_boost: number
        }
        Insert: {
          badge_color?: string
          commission_rate?: number
          created_at?: string
          display_name: string
          features?: Json
          id?: string
          level: number
          min_fulfillment_rate?: number
          min_orders?: number
          min_rating?: number
          min_revenue?: number
          name: string
          payout_days?: number
          promo_credits_monthly?: number
          visibility_boost?: number
        }
        Update: {
          badge_color?: string
          commission_rate?: number
          created_at?: string
          display_name?: string
          features?: Json
          id?: string
          level?: number
          min_fulfillment_rate?: number
          min_orders?: number
          min_rating?: number
          min_revenue?: number
          name?: string
          payout_days?: number
          promo_credits_monthly?: number
          visibility_boost?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      collection_products: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_activity_log: {
        Row: {
          activity_type: string
          category: string | null
          created_at: string
          id: string
          metadata: Json | null
          product_id: string | null
          store_id: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          category?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          store_id?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          category?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          product_id?: string | null
          store_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      consumer_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          is_featured: boolean
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          is_featured?: boolean
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          is_featured?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_preferences: {
        Row: {
          created_at: string
          default_location: Json | null
          id: string
          notification_preferences: Json | null
          preferred_categories: string[] | null
          preferred_vendors: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_location?: Json | null
          id?: string
          notification_preferences?: Json | null
          preferred_categories?: string[] | null
          preferred_vendors?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_location?: Json | null
          id?: string
          notification_preferences?: Json | null
          preferred_categories?: string[] | null
          preferred_vendors?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumer_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_order_week: string | null
          longest_streak: number
          streak_start_date: string | null
          total_weeks_ordered: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_order_week?: string | null
          longest_streak?: number
          streak_start_date?: string | null
          total_weeks_ordered?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_order_week?: string | null
          longest_streak?: number
          streak_start_date?: string | null
          total_weeks_ordered?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          last_message_at: string | null
          order_id: string | null
          status: string | null
          store_id: string
          subject: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string | null
          store_id: string
          subject: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          last_message_at?: string | null
          order_id?: string | null
          status?: string | null
          store_id?: string
          subject?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_promotions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          initiator_products: string[] | null
          initiator_vendor_id: string
          partner_products: string[] | null
          partner_vendor_id: string
          promo_type: string
          start_date: string | null
          status: string
          terms: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          initiator_products?: string[] | null
          initiator_vendor_id: string
          partner_products?: string[] | null
          partner_vendor_id: string
          promo_type: string
          start_date?: string | null
          status?: string
          terms: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          initiator_products?: string[] | null
          initiator_vendor_id?: string
          partner_products?: string[] | null
          partner_vendor_id?: string
          promo_type?: string
          start_date?: string | null
          status?: string
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_promotions_initiator_vendor_id_fkey"
            columns: ["initiator_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_promotions_partner_vendor_id_fkey"
            columns: ["partner_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          created_at: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          id: string
          is_active: boolean | null
          rate_to_usd: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          id?: string
          is_active?: boolean | null
          rate_to_usd: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          is_active?: boolean | null
          rate_to_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_attribute_values: {
        Row: {
          attribute_type_id: string
          color_hex: string | null
          created_at: string
          id: string
          image_url: string | null
          value: string
          vendor_id: string
        }
        Insert: {
          attribute_type_id: string
          color_hex?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          value: string
          vendor_id: string
        }
        Update: {
          attribute_type_id?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          value?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_attribute_values_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_attribute_values_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_mining_limits: {
        Row: {
          created_at: string
          id: string
          mining_date: string
          tasks_completed: number | null
          total_mined: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mining_date?: string
          tasks_completed?: number | null
          total_mined?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mining_date?: string
          tasks_completed?: number | null
          total_mined?: number | null
          user_id?: string
        }
        Relationships: []
      }
      delivery_earnings: {
        Row: {
          base_pay: number
          created_at: string
          delivery_job_id: string
          distance_km: number | null
          distance_pay: number
          driver_id: string
          id: string
          is_priority: boolean | null
          surge_multiplier: number | null
          surge_pay: number
          tier_bonus: number
          tip_amount: number
          total_earnings: number
          urgency_pay: number
        }
        Insert: {
          base_pay?: number
          created_at?: string
          delivery_job_id: string
          distance_km?: number | null
          distance_pay?: number
          driver_id: string
          id?: string
          is_priority?: boolean | null
          surge_multiplier?: number | null
          surge_pay?: number
          tier_bonus?: number
          tip_amount?: number
          total_earnings?: number
          urgency_pay?: number
        }
        Update: {
          base_pay?: number
          created_at?: string
          delivery_job_id?: string
          distance_km?: number | null
          distance_pay?: number
          driver_id?: string
          id?: string
          is_priority?: boolean | null
          surge_multiplier?: number | null
          surge_pay?: number
          tier_bonus?: number
          tip_amount?: number
          total_earnings?: number
          urgency_pay?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_earnings_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_jobs: {
        Row: {
          actual_delivery_time: string | null
          created_at: string
          delivery_address: Json
          distance_km: number | null
          driver_id: string | null
          earnings: number | null
          estimated_delivery_time: string | null
          id: string
          notes: string | null
          order_id: string | null
          pickup_address: Json
          pickup_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_delivery_time?: string | null
          created_at?: string
          delivery_address: Json
          distance_km?: number | null
          driver_id?: string | null
          earnings?: number | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pickup_address: Json
          pickup_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_delivery_time?: string | null
          created_at?: string
          delivery_address?: Json
          distance_km?: number | null
          driver_id?: string | null
          earnings?: number | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pickup_address?: Json
          pickup_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tips: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          delivery_job_id: string | null
          driver_id: string | null
          id: string
          is_prepaid: boolean
          order_id: string
          paid_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          delivery_job_id?: string | null
          driver_id?: string | null
          id?: string
          is_prepaid?: boolean
          order_id: string
          paid_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          delivery_job_id?: string | null
          driver_id?: string | null
          id?: string
          is_prepaid?: boolean
          order_id?: string
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tips_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      downloadable_files: {
        Row: {
          created_at: string
          download_limit: number | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_limit?: number | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_limit?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloadable_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_analytics: {
        Row: {
          average_delivery_time_mins: number | null
          created_at: string
          date: string
          deliveries_completed: number | null
          driver_id: string
          id: string
          total_distance_km: number | null
          total_earnings: number | null
        }
        Insert: {
          average_delivery_time_mins?: number | null
          created_at?: string
          date?: string
          deliveries_completed?: number | null
          driver_id: string
          id?: string
          total_distance_km?: number | null
          total_earnings?: number | null
        }
        Update: {
          average_delivery_time_mins?: number | null
          created_at?: string
          date?: string
          deliveries_completed?: number | null
          driver_id?: string
          id?: string
          total_distance_km?: number | null
          total_earnings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_analytics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_cashouts: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          fee_amount: number
          fee_percent: number
          id: string
          net_amount: number
          payment_method: string
          payment_reference: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          fee_amount?: number
          fee_percent?: number
          id?: string
          net_amount: number
          payment_method: string
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          fee_amount?: number
          fee_percent?: number
          id?: string
          net_amount?: number
          payment_method?: string
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_cashouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_investments: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          investment_type: string
          maturity_date: string | null
          returns_earned: number
          status: string
          target_vendor_id: string | null
          ucoin_spent: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          investment_type: string
          maturity_date?: string | null
          returns_earned?: number
          status?: string
          target_vendor_id?: string | null
          ucoin_spent?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          investment_type?: string
          maturity_date?: string | null
          returns_earned?: number
          status?: string
          target_vendor_id?: string | null
          ucoin_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_investments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_investments_target_vendor_id_fkey"
            columns: ["target_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          created_at: string
          deliveries_count: number | null
          driver_id: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          processed_by: string | null
          status: string
          total_distance_km: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deliveries_count?: number | null
          driver_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_distance_km?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deliveries_count?: number | null
          driver_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          total_distance_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_performance_stats: {
        Row: {
          accepted_jobs: number
          average_rating: number | null
          created_at: string
          driver_id: string
          id: string
          offered_jobs: number
          ontime_deliveries: number
          period_end: string
          period_start: string
          total_deliveries: number
          total_earnings: number
          total_tips: number
        }
        Insert: {
          accepted_jobs?: number
          average_rating?: number | null
          created_at?: string
          driver_id: string
          id?: string
          offered_jobs?: number
          ontime_deliveries?: number
          period_end: string
          period_start: string
          total_deliveries?: number
          total_earnings?: number
          total_tips?: number
        }
        Update: {
          accepted_jobs?: number
          average_rating?: number | null
          created_at?: string
          driver_id?: string
          id?: string
          offered_jobs?: number
          ontime_deliveries?: number
          period_end?: string
          period_start?: string
          total_deliveries?: number
          total_earnings?: number
          total_tips?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_performance_stats_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_tier_history: {
        Row: {
          created_at: string
          driver_id: string
          effective_date: string
          id: string
          previous_tier_id: string | null
          reason: string | null
          tier_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          effective_date?: string
          id?: string
          previous_tier_id?: string | null
          reason?: string | null
          tier_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          effective_date?: string
          id?: string
          previous_tier_id?: string | null
          reason?: string | null
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_tier_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_tier_history_previous_tier_id_fkey"
            columns: ["previous_tier_id"]
            isOneToOne: false
            referencedRelation: "driver_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_tier_history_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "driver_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_tiers: {
        Row: {
          badge_color: string
          base_pay_multiplier: number
          cashout_fee_percent: number
          created_at: string
          display_name: string
          features: Json
          id: string
          insurance_coverage_percent: number
          level: number
          min_acceptance_rate: number
          min_deliveries: number
          min_ontime_rate: number
          min_rating: number
          name: string
          priority_job_access: boolean
        }
        Insert: {
          badge_color?: string
          base_pay_multiplier?: number
          cashout_fee_percent?: number
          created_at?: string
          display_name: string
          features?: Json
          id?: string
          insurance_coverage_percent?: number
          level: number
          min_acceptance_rate?: number
          min_deliveries?: number
          min_ontime_rate?: number
          min_rating?: number
          name: string
          priority_job_access?: boolean
        }
        Update: {
          badge_color?: string
          base_pay_multiplier?: number
          cashout_fee_percent?: number
          created_at?: string
          display_name?: string
          features?: Json
          id?: string
          insurance_coverage_percent?: number
          level?: number
          min_acceptance_rate?: number
          min_deliveries?: number
          min_ontime_rate?: number
          min_rating?: number
          name?: string
          priority_job_access?: boolean
        }
        Relationships: []
      }
      driver_vehicle_fund: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          purpose: string | null
          status: string
          target_amount: number | null
          total_saved: number
          ucoin_contributed: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          purpose?: string | null
          status?: string
          target_amount?: number | null
          total_saved?: number
          ucoin_contributed?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          purpose?: string | null
          status?: string
          target_amount?: number | null
          total_saved?: number
          ucoin_contributed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_fund_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          acceptance_rate: number | null
          available_balance: number | null
          created_at: string
          current_location: Json | null
          id: string
          license_number: string | null
          name: string
          ontime_rate: number | null
          phone: string | null
          rating: number | null
          status: string
          tier_id: string | null
          total_deliveries: number | null
          total_earnings: number | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_photo_url: string | null
          vehicle_registration: string | null
          vehicle_type: string | null
          vehicle_year: number | null
        }
        Insert: {
          acceptance_rate?: number | null
          available_balance?: number | null
          created_at?: string
          current_location?: Json | null
          id?: string
          license_number?: string | null
          name: string
          ontime_rate?: number | null
          phone?: string | null
          rating?: number | null
          status?: string
          tier_id?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_photo_url?: string | null
          vehicle_registration?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Update: {
          acceptance_rate?: number | null
          available_balance?: number | null
          created_at?: string
          current_location?: Json | null
          id?: string
          license_number?: string | null
          name?: string
          ontime_rate?: number | null
          phone?: string | null
          rating?: number | null
          status?: string
          tier_id?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_photo_url?: string | null
          vehicle_registration?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "driver_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_deals: {
        Row: {
          claimed_count: number
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_time: string
          flash_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          original_price: number | null
          product_id: string | null
          start_time: string
          stock_limit: number | null
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value: number
          end_time: string
          flash_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          original_price?: number | null
          product_id?: string | null
          start_time: string
          stock_limit?: number | null
          store_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          claimed_count?: number
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_time?: string
          flash_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          original_price?: number | null
          product_id?: string | null
          start_time?: string
          stock_limit?: number | null
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_deals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_price_cache: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          is_current: boolean | null
          price_per_gram_usd: number
          price_per_mg_usd: number
          price_per_oz_usd: number
          source: string | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          is_current?: boolean | null
          price_per_gram_usd: number
          price_per_mg_usd: number
          price_per_oz_usd: number
          source?: string | null
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          is_current?: boolean | null
          price_per_gram_usd?: number
          price_per_mg_usd?: number
          price_per_oz_usd?: number
          source?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          failed_items: number
          id: string
          metadata: Json | null
          processed_items: number
          source: string
          started_at: string
          status: string
          successful_items: number
          total_items: number
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          failed_items?: number
          id?: string
          metadata?: Json | null
          processed_items?: number
          source: string
          started_at?: string
          status?: string
          successful_items?: number
          total_items?: number
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          failed_items?: number
          id?: string
          metadata?: Json | null
          processed_items?: number
          source?: string
          started_at?: string
          status?: string
          successful_items?: number
          total_items?: number
        }
        Relationships: []
      }
      inbound_emails: {
        Row: {
          attachment_count: number | null
          body_html: string | null
          body_text: string | null
          created_at: string
          from_address: string
          has_attachments: boolean | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          processed_at: string | null
          processed_by: string | null
          raw_payload: Json | null
          received_at: string | null
          subject: string
          to_addresses: string[]
        }
        Insert: {
          attachment_count?: number | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_address: string
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          subject?: string
          to_addresses: string[]
        }
        Update: {
          attachment_count?: number | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          from_address?: string
          has_attachments?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          subject?: string
          to_addresses?: string[]
        }
        Relationships: []
      }
      inventory_settings: {
        Row: {
          auto_restock_enabled: boolean | null
          created_at: string | null
          id: string
          notification_threshold: number | null
          notifications_enabled: boolean | null
          restock_quantity: number | null
          restock_threshold: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          auto_restock_enabled?: boolean | null
          created_at?: string | null
          id?: string
          notification_threshold?: number | null
          notifications_enabled?: boolean | null
          restock_quantity?: number | null
          restock_threshold?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          auto_restock_enabled?: boolean | null
          created_at?: string | null
          id?: string
          notification_threshold?: number | null
          notifications_enabled?: boolean | null
          restock_quantity?: number | null
          restock_threshold?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          read: boolean | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_campaigns: {
        Row: {
          banner_url: string | null
          bonus_multiplier: number | null
          created_at: string
          current_participants: number | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean | null
          max_participants: number | null
          start_date: string
          task_id: string | null
          title: string
        }
        Insert: {
          banner_url?: string | null
          bonus_multiplier?: number | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          start_date: string
          task_id?: string | null
          title: string
        }
        Update: {
          banner_url?: string | null
          bonus_multiplier?: number | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          start_date?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_campaigns_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mining_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_completions: {
        Row: {
          base_reward: number
          campaign_id: string | null
          created_at: string
          final_reward: number
          id: string
          multiplier: number | null
          proof_data: Json | null
          proof_url: string | null
          social_account_id: string | null
          status: string | null
          task_id: string
          user_id: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          base_reward: number
          campaign_id?: string | null
          created_at?: string
          final_reward: number
          id?: string
          multiplier?: number | null
          proof_data?: Json | null
          proof_url?: string | null
          social_account_id?: string | null
          status?: string | null
          task_id: string
          user_id: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          base_reward?: number
          campaign_id?: string | null
          created_at?: string
          final_reward?: number
          id?: string
          multiplier?: number | null
          proof_data?: Json | null
          proof_url?: string | null
          social_account_id?: string | null
          status?: string | null
          task_id?: string
          user_id?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_completions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mining_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_completions_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mining_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_tasks: {
        Row: {
          base_reward: number
          category: string
          cooldown_hours: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_daily_completions: number | null
          min_followers: number | null
          platform: string | null
          requires_verification: boolean | null
          reward_tier: string | null
          task_type: string
          title: string
          updated_at: string
          verification_type: string | null
        }
        Insert: {
          base_reward: number
          category: string
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_daily_completions?: number | null
          min_followers?: number | null
          platform?: string | null
          requires_verification?: boolean | null
          reward_tier?: string | null
          task_type: string
          title: string
          updated_at?: string
          verification_type?: string | null
        }
        Update: {
          base_reward?: number
          category?: string
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_daily_completions?: number | null
          min_followers?: number | null
          platform?: string | null
          requires_verification?: boolean | null
          reward_tier?: string | null
          task_type?: string
          title?: string
          updated_at?: string
          verification_type?: string | null
        }
        Relationships: []
      }
      order_history: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_insurance: {
        Row: {
          claim_reason: string | null
          claimed_at: string | null
          coverage_amount: number
          coverage_type: string
          created_at: string
          id: string
          order_id: string
          status: string
          ucoin_cost: number
          user_id: string
        }
        Insert: {
          claim_reason?: string | null
          claimed_at?: string | null
          coverage_amount: number
          coverage_type?: string
          created_at?: string
          id?: string
          order_id: string
          status?: string
          ucoin_cost: number
          user_id: string
        }
        Update: {
          claim_reason?: string | null
          claimed_at?: string | null
          coverage_amount?: number
          coverage_type?: string
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          ucoin_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_insurance_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          gold_rate_at_purchase: number | null
          id: string
          order_id: string
          price: number
          price_mg_gold: number | null
          product_id: string
          quantity: number
          status: string
          store_id: string
          updated_at: string
          variation_id: string | null
          vendor_status: string
        }
        Insert: {
          created_at?: string
          gold_rate_at_purchase?: number | null
          id?: string
          order_id: string
          price: number
          price_mg_gold?: number | null
          product_id: string
          quantity: number
          status?: string
          store_id: string
          updated_at?: string
          variation_id?: string | null
          vendor_status?: string
        }
        Update: {
          created_at?: string
          gold_rate_at_purchase?: number | null
          id?: string
          order_id?: string
          price?: number
          price_mg_gold?: number | null
          product_id?: string
          quantity?: number
          status?: string
          store_id?: string
          updated_at?: string
          variation_id?: string | null
          vendor_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          courier_company: string | null
          courier_name: string | null
          courier_phone: string | null
          created_at: string
          estimated_delivery: string | null
          gold_rate_at_checkout: number | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          refund_amount: number | null
          refund_reason: string | null
          refund_status: string | null
          return_reason: string | null
          return_status: string | null
          shipping_address: Json
          shipping_method: string | null
          status: string
          total: number
          total_mg_gold: number | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          courier_company?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          created_at?: string
          estimated_delivery?: string | null
          gold_rate_at_checkout?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          refund_amount?: number | null
          refund_reason?: string | null
          refund_status?: string | null
          return_reason?: string | null
          return_status?: string | null
          shipping_address: Json
          shipping_method?: string | null
          status?: string
          total: number
          total_mg_gold?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          courier_company?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          created_at?: string
          estimated_delivery?: string | null
          gold_rate_at_checkout?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          refund_amount?: number | null
          refund_reason?: string | null
          refund_status?: string | null
          return_reason?: string | null
          return_status?: string | null
          shipping_address?: Json
          shipping_method?: string | null
          status?: string
          total?: number
          total_mg_gold?: number | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          payout_date: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payout_date?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payout_date?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          platform_email: string
          platform_fee: number
          platform_name: string
          privacy_policy: string | null
          support_email: string
          terms_of_service: string | null
          updated_at: string
          vendor_fee: number
        }
        Insert: {
          created_at?: string
          id?: string
          platform_email: string
          platform_fee?: number
          platform_name?: string
          privacy_policy?: string | null
          support_email: string
          terms_of_service?: string | null
          updated_at?: string
          vendor_fee?: number
        }
        Update: {
          created_at?: string
          id?: string
          platform_email?: string
          platform_fee?: number
          platform_name?: string
          privacy_policy?: string | null
          support_email?: string
          terms_of_service?: string | null
          updated_at?: string
          vendor_fee?: number
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          image_url: string | null
          price: number
          price_currency: string | null
          price_mg_gold: number | null
          product_id: string
          quantity: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          attributes: Json
          created_at?: string
          id?: string
          image_url?: string | null
          price: number
          price_currency?: string | null
          price_mg_gold?: number | null
          product_id: string
          quantity?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number
          price_currency?: string | null
          price_mg_gold?: number | null
          product_id?: string
          quantity?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          compare_at_price: number | null
          created_at: string
          description: string | null
          external_id: string | null
          external_source: string | null
          id: string
          name: string
          price: number
          price_currency: string | null
          price_mg_gold: number | null
          price_snapshot_at: string | null
          price_snapshot_gold_rate: number | null
          product_type: string
          quantity: number
          rating: number | null
          review_count: number | null
          sku: string | null
          slug: string
          status: string
          store_id: string
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          category: string
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          name: string
          price: number
          price_currency?: string | null
          price_mg_gold?: number | null
          price_snapshot_at?: string | null
          price_snapshot_gold_rate?: number | null
          product_type?: string
          quantity?: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          slug: string
          status?: string
          store_id: string
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          name?: string
          price?: number
          price_currency?: string | null
          price_mg_gold?: number | null
          price_snapshot_at?: string | null
          price_snapshot_gold_rate?: number | null
          product_type?: string
          quantity?: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          slug?: string
          status?: string
          store_id?: string
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promo_credit_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          vendor_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          vendor_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_credit_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_monthly_grant: string | null
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_monthly_grant?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_monthly_grant?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_credits_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string
          created_at: string | null
          end_date: string
          id: string
          min_order_value: number | null
          name: string
          products: Json | null
          start_date: string
          status: string | null
          store_id: string
          type: string
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          end_date: string
          id?: string
          min_order_value?: number | null
          name: string
          products?: Json | null
          start_date: string
          status?: string | null
          store_id: string
          type: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          end_date?: string
          id?: string
          min_order_value?: number | null
          name?: string
          products?: Json | null
          start_date?: string
          status?: string | null
          store_id?: string
          type?: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_bids: {
        Row: {
          auction_id: string
          created_at: string
          id: string
          is_active: boolean
          max_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_mining_bonuses: {
        Row: {
          beneficiary_id: string
          bonus_amount: number
          bonus_percent: number
          completion_id: string
          created_at: string
          id: string
          miner_id: string
          referral_level: number
          status: string | null
        }
        Insert: {
          beneficiary_id: string
          bonus_amount: number
          bonus_percent: number
          completion_id: string
          created_at?: string
          id?: string
          miner_id: string
          referral_level: number
          status?: string | null
        }
        Update: {
          beneficiary_id?: string
          bonus_amount?: number
          bonus_percent?: number
          completion_id?: string
          created_at?: string
          id?: string
          miner_id?: string
          referral_level?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_mining_bonuses_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "mining_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          first_order_bonus_paid: boolean | null
          first_purchase_amount: number | null
          first_purchase_date: string | null
          id: string
          purchase_reward_paid: boolean
          referral_code: string
          referred_id: string
          referrer_id: string
          signup_date: string | null
          signup_reward_paid: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_order_bonus_paid?: boolean | null
          first_purchase_amount?: number | null
          first_purchase_date?: string | null
          id?: string
          purchase_reward_paid?: boolean
          referral_code: string
          referred_id: string
          referrer_id: string
          signup_date?: string | null
          signup_reward_paid?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_order_bonus_paid?: boolean | null
          first_purchase_amount?: number | null
          first_purchase_date?: string | null
          id?: string
          purchase_reward_paid?: boolean
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          signup_date?: string | null
          signup_reward_paid?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          flagged: boolean | null
          id: string
          images: string[] | null
          order_id: string | null
          product_id: string
          rating: number
          sentiment: string | null
          updated_at: string | null
          user_id: string
          vendor_responded_at: string | null
          vendor_response: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          flagged?: boolean | null
          id?: string
          images?: string[] | null
          order_id?: string | null
          product_id: string
          rating: number
          sentiment?: string | null
          updated_at?: string | null
          user_id: string
          vendor_responded_at?: string | null
          vendor_response?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          flagged?: boolean | null
          id?: string
          images?: string[] | null
          order_id?: string | null
          product_id?: string
          rating?: number
          sentiment?: string | null
          updated_at?: string | null
          user_id?: string
          vendor_responded_at?: string | null
          vendor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          created_at: string
          free_shipping_threshold: number | null
          id: string
          is_active: boolean
          max_order_value: number | null
          max_weight: number | null
          min_order_value: number | null
          min_weight: number | null
          name: string
          price: number
          rate_type: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          max_order_value?: number | null
          max_weight?: number | null
          min_order_value?: number | null
          min_weight?: number | null
          name: string
          price?: number
          rate_type: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          max_order_value?: number | null
          max_weight?: number | null
          min_order_value?: number | null
          min_weight?: number | null
          name?: string
          price?: number
          rate_type?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          countries: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          postal_codes: Json | null
          provinces: Json | null
          updated_at: string
        }
        Insert: {
          countries?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          postal_codes?: Json | null
          provinces?: Json | null
          updated_at?: string
        }
        Update: {
          countries?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          postal_codes?: Json | null
          provinces?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          avatar_url: string | null
          connected_at: string
          created_at: string
          display_name: string | null
          follower_count: number | null
          id: string
          is_verified: boolean | null
          last_synced_at: string | null
          platform: string
          platform_user_id: string
          profile_url: string | null
          refresh_token: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          access_token?: string | null
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          last_synced_at?: string | null
          platform: string
          platform_user_id: string
          profile_url?: string | null
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          access_token?: string | null
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          display_name?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          last_synced_at?: string | null
          platform?: string
          platform_user_id?: string
          profile_url?: string | null
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      sponsored_placements: {
        Row: {
          clicks: number
          conversions: number
          created_at: string
          credit_cost: number
          end_time: string
          id: string
          impressions: number
          placement_type: string
          product_id: string | null
          start_time: string
          status: string
          store_id: string | null
          vendor_id: string
        }
        Insert: {
          clicks?: number
          conversions?: number
          created_at?: string
          credit_cost: number
          end_time: string
          id?: string
          impressions?: number
          placement_type: string
          product_id?: string | null
          start_time: string
          status?: string
          store_id?: string | null
          vendor_id: string
        }
        Update: {
          clicks?: number
          conversions?: number
          created_at?: string
          credit_cost?: number
          end_time?: string
          id?: string
          impressions?: number
          placement_type?: string
          product_id?: string | null
          start_time?: string
          status?: string
          store_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_placements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_placements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          pricing_currency: string | null
          return_policy: string | null
          shipping_policy: string | null
          slug: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          pricing_currency?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          pricing_currency?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          features: Json
          id: string
          max_orders: number | null
          max_products: number | null
          name: string
          price: number
          support_level: string | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          max_orders?: number | null
          max_products?: number | null
          name: string
          price?: number
          support_level?: string | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          max_orders?: number | null
          max_products?: number | null
          name?: string
          price?: number
          support_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      surge_zones: {
        Row: {
          created_at: string
          days_active: number[] | null
          end_time: string | null
          id: string
          is_active: boolean
          name: string
          polygon: Json
          start_time: string | null
          surge_multiplier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_active?: number[] | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name: string
          polygon: Json
          start_time?: string | null
          surge_multiplier?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_active?: number[] | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
          polygon?: Json
          start_time?: string | null
          surge_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      ucoin_earning_rules: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          multiplier: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ucoin_spending_options: {
        Row: {
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_balance: number | null
          updated_at: string
          user_types: string[] | null
          value: number
          value_type: string
        }
        Insert: {
          category: string
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_balance?: number | null
          updated_at?: string
          user_types?: string[] | null
          value: number
          value_type: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_balance?: number | null
          updated_at?: string
          user_types?: string[] | null
          value?: number
          value_type?: string
        }
        Relationships: []
      }
      ucoin_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          recipient_id: string | null
          reference_id: string | null
          reference_type: string | null
          sender_id: string | null
          transfer_fee_mg: number | null
          transfer_reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          recipient_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sender_id?: string | null
          transfer_fee_mg?: number | null
          transfer_reference?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          recipient_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sender_id?: string | null
          transfer_fee_mg?: number | null
          transfer_reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ucoin_transfer_limits: {
        Row: {
          created_at: string
          daily_limit_mg: number
          id: string
          min_transfer_mg: number
          monthly_limit_mg: number
          requires_2fa_above_mg: number
          single_transfer_max_mg: number
          updated_at: string
          user_tier: string
        }
        Insert: {
          created_at?: string
          daily_limit_mg?: number
          id?: string
          min_transfer_mg?: number
          monthly_limit_mg?: number
          requires_2fa_above_mg?: number
          single_transfer_max_mg?: number
          updated_at?: string
          user_tier?: string
        }
        Update: {
          created_at?: string
          daily_limit_mg?: number
          id?: string
          min_transfer_mg?: number
          monthly_limit_mg?: number
          requires_2fa_above_mg?: number
          single_transfer_max_mg?: number
          updated_at?: string
          user_tier?: string
        }
        Relationships: []
      }
      ucoin_transfer_usage: {
        Row: {
          created_at: string
          daily_transferred_mg: number
          id: string
          monthly_transferred_mg: number
          transfer_count: number
          transfer_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_transferred_mg?: number
          id?: string
          monthly_transferred_mg?: number
          transfer_count?: number
          transfer_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_transferred_mg?: number
          id?: string
          monthly_transferred_mg?: number
          transfer_count?: number
          transfer_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ucoin_user_settings: {
        Row: {
          created_at: string
          display_mode: string
          id: string
          is_transfer_enabled: boolean
          preferred_gold_unit: string
          requires_2fa: boolean
          updated_at: string
          user_id: string
          user_tier: string
        }
        Insert: {
          created_at?: string
          display_mode?: string
          id?: string
          is_transfer_enabled?: boolean
          preferred_gold_unit?: string
          requires_2fa?: boolean
          updated_at?: string
          user_id: string
          user_tier?: string
        }
        Update: {
          created_at?: string
          display_mode?: string
          id?: string
          is_transfer_enabled?: boolean
          preferred_gold_unit?: string
          requires_2fa?: boolean
          updated_at?: string
          user_id?: string
          user_tier?: string
        }
        Relationships: []
      }
      ucoin_velocity_log: {
        Row: {
          action_type: string
          amount_mg: number
          counterparty_id: string | null
          created_at: string
          device_fingerprint: string | null
          flag_reason: string | null
          id: string
          ip_address: string | null
          is_flagged: boolean
          user_id: string
        }
        Insert: {
          action_type: string
          amount_mg: number
          counterparty_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          flag_reason?: string | null
          id?: string
          ip_address?: string | null
          is_flagged?: boolean
          user_id: string
        }
        Update: {
          action_type?: string
          amount_mg?: number
          counterparty_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          flag_reason?: string | null
          id?: string
          ip_address?: string | null
          is_flagged?: boolean
          user_id?: string
        }
        Relationships: []
      }
      ucoin_wallets: {
        Row: {
          balance: number
          created_at: string
          gold_balance_mg: number | null
          id: string
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          gold_balance_mg?: number | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          gold_balance_mg?: number | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          name: string
          phone: string | null
          postal_code: string
          province: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          name: string
          phone?: string | null
          postal_code: string
          province: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          name?: string
          phone?: string | null
          postal_code?: string
          province?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_affiliate_status: {
        Row: {
          affiliate_code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_mining_date: string | null
          tier_id: string | null
          today_mined: number | null
          total_conversions: number | null
          total_mined: number | null
          total_referrals: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_mining_date?: string | null
          tier_id?: string | null
          today_mined?: number | null
          total_conversions?: number | null
          total_mined?: number | null
          total_referrals?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_mining_date?: string | null
          tier_id?: string | null
          today_mined?: number | null
          total_conversions?: number | null
          total_mined?: number | null
          total_referrals?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_affiliate_status_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "affiliate_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_currency_preferences: {
        Row: {
          created_at: string
          display_mode: string | null
          gold_unit: string | null
          id: string
          preferred_currency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_mode?: string | null
          gold_unit?: string | null
          id?: string
          preferred_currency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_mode?: string | null
          gold_unit?: string | null
          id?: string
          preferred_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          total_earned: number
          updated_at: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          total_earned?: number
          updated_at?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          total_earned?: number
          updated_at?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variation_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          position: number
          variation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          position?: number
          variation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          position?: number
          variation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variation_images_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          document_type: string
          document_url: string
          id: string
          status: string
          updated_at: string
          uploaded_at: string
          vendor_id: string
        }
        Insert: {
          document_type: string
          document_url: string
          id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          vendor_id: string
        }
        Update: {
          document_type?: string
          document_url?: string
          id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payment_methods: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string | null
          bank_name: string
          created_at: string | null
          id: string
          is_default: boolean | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type?: string | null
          bank_name: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string | null
          bank_name?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payment_methods_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_subscription_features: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          reset_at: string | null
          updated_at: string
          usage_count: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          reset_at?: string | null
          updated_at?: string
          usage_count?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          reset_at?: string | null
          updated_at?: string
          usage_count?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscription_features_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_subscription_usage: {
        Row: {
          created_at: string
          current_value: number
          id: string
          limit_value: number | null
          metric_type: string
          period_end: string
          period_start: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          limit_value?: number | null
          metric_type: string
          period_end?: string
          period_start?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          limit_value?: number | null
          metric_type?: string
          period_end?: string
          period_start?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscription_usage_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_upgrade_triggers: {
        Row: {
          dismissed_at: string | null
          id: string
          is_dismissed: boolean | null
          trigger_data: Json | null
          trigger_type: string
          triggered_at: string
          vendor_id: string
        }
        Insert: {
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          trigger_data?: Json | null
          trigger_type: string
          triggered_at?: string
          vendor_id: string
        }
        Update: {
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          trigger_data?: Json | null
          trigger_type?: string
          triggered_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_upgrade_triggers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          ad_credits: number | null
          approval_date: string | null
          business_address: string | null
          business_email: string | null
          business_name: string
          business_phone: string | null
          business_type: string | null
          commission_rate: number | null
          created_at: string
          default_pricing_currency: string | null
          description: string | null
          features_config: Json | null
          id: string
          logo_url: string | null
          monthly_promotions_limit: number | null
          monthly_promotions_used: number | null
          payout_days: number | null
          search_boost: number | null
          status: string
          subscription_expires_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          tax_id: string | null
          tier_id: string | null
          tier_updated_at: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          ad_credits?: number | null
          approval_date?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name: string
          business_phone?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          default_pricing_currency?: string | null
          description?: string | null
          features_config?: Json | null
          id?: string
          logo_url?: string | null
          monthly_promotions_limit?: number | null
          monthly_promotions_used?: number | null
          payout_days?: number | null
          search_boost?: number | null
          status?: string
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tier_id?: string | null
          tier_updated_at?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          ad_credits?: number | null
          approval_date?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string
          business_phone?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          default_pricing_currency?: string | null
          description?: string | null
          features_config?: Json | null
          id?: string
          logo_url?: string | null
          monthly_promotions_limit?: number | null
          monthly_promotions_used?: number | null
          payout_days?: number | null
          search_boost?: number | null
          status?: string
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tier_id?: string | null
          tier_updated_at?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "brand_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_ucoin: {
        Args: {
          p_category: string
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: boolean
      }
      award_user_badges: { Args: { p_user_id: string }; Returns: number }
      calculate_delivery_earnings: {
        Args: {
          p_delivery_job_id: string
          p_distance_km: number
          p_is_urgent?: boolean
          p_surge_multiplier?: number
        }
        Returns: number
      }
      can_vendor_add_product: {
        Args: { p_vendor_id: string }
        Returns: boolean
      }
      can_vendor_create_promotion: {
        Args: { p_vendor_id: string }
        Returns: boolean
      }
      check_and_award_badges: { Args: { p_user_id: string }; Returns: number }
      check_vendor_upgrade_triggers: {
        Args: { p_vendor_id: string }
        Returns: Json
      }
      complete_mining_task: {
        Args: {
          p_campaign_id?: string
          p_proof_data?: Json
          p_proof_url?: string
          p_social_account_id?: string
          p_task_id: string
          p_user_id: string
        }
        Returns: Json
      }
      currency_to_mg_gold: {
        Args: { p_amount: number; p_currency_code: string }
        Returns: number
      }
      evaluate_driver_tier: { Args: { p_driver_id: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_current_gold_price: {
        Args: never
        Returns: {
          fetched_at: string
          price_per_gram_usd: number
          price_per_mg_usd: number
          price_per_oz_usd: number
        }[]
      }
      get_or_create_referral_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_ucoin_transfers: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          amount: number
          counterparty_id: string
          created_at: string
          direction: string
          fee_mg: number
          id: string
          note: string
          transfer_reference: string
          type: string
        }[]
      }
      get_user_affiliate_tier: {
        Args: { p_user_id: string }
        Returns: {
          badge_color: string
          daily_cap: number
          display_name: string
          level: number
          mining_multiplier: number
          tier_id: string
          tier_name: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_transfer_limits: {
        Args: { p_user_id: string }
        Returns: {
          daily_limit_mg: number
          daily_used_mg: number
          min_transfer_mg: number
          monthly_limit_mg: number
          monthly_used_mg: number
          remaining_daily_mg: number
          remaining_monthly_mg: number
          requires_2fa_above_mg: number
          single_transfer_max_mg: number
        }[]
      }
      get_vendor_features: { Args: { vendor_id: string }; Returns: Json }
      get_vendor_tier_config: { Args: { p_vendor_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_auction_active: { Args: { _auction_id: string }; Returns: boolean }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      is_registered_for_auction: {
        Args: { _auction_id: string; _user_id: string }
        Returns: boolean
      }
      is_trial_expired: { Args: { vendor_id: string }; Returns: boolean }
      is_vendor: { Args: { _user_id: string }; Returns: boolean }
      mg_gold_to_currency: {
        Args: { p_currency_code: string; p_mg_gold: number }
        Returns: number
      }
      process_referral_mining_bonus: {
        Args: { p_completion_id: string; p_miner_id: string; p_reward: number }
        Returns: undefined
      }
      process_referral_signup: {
        Args: { p_referral_code: string; p_referred_id: string }
        Returns: boolean
      }
      reset_demo_data: { Args: { p_scopes: string[] }; Returns: Json }
      transfer_ucoin: {
        Args: {
          p_amount_mg: number
          p_device_fingerprint?: string
          p_ip_address?: string
          p_note?: string
          p_recipient_identifier: string
          p_sender_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "consumer" | "vendor" | "admin" | "driver"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["consumer", "vendor", "admin", "driver"],
    },
  },
} as const
