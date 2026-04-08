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
      approved_social_accounts: {
        Row: {
          account_handle: string
          account_url: string | null
          added_by_admin: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          platform: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_handle: string
          account_url?: string | null
          added_by_admin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          platform: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_handle?: string
          account_url?: string | null
          added_by_admin?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          platform?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          completed_date: string | null
          contract_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          maintenance_type: string
          notes: string | null
          performed_by: string | null
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          completed_date?: string | null
          contract_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          completed_date?: string | null
          contract_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "leaseable_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_providers: {
        Row: {
          business_registration: string | null
          commission_rate: number | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          status: string
          total_assets: number | null
          total_revenue: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_registration?: string | null
          commission_rate?: number | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          status?: string
          total_assets?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_registration?: string | null
          commission_rate?: number | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          status?: string
          total_assets?: number | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_tracking: {
        Row: {
          asset_id: string
          battery_level: number | null
          contract_id: string | null
          created_at: string
          id: string
          is_disabled: boolean | null
          last_ping_at: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          mileage_km: number | null
          updated_at: string
          usage_hours: number | null
        }
        Insert: {
          asset_id: string
          battery_level?: number | null
          contract_id?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean | null
          last_ping_at?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          mileage_km?: number | null
          updated_at?: string
          usage_hours?: number | null
        }
        Update: {
          asset_id?: string
          battery_level?: number | null
          contract_id?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean | null
          last_ping_at?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          mileage_km?: number | null
          updated_at?: string
          usage_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_tracking_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "leaseable_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tracking_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id"]
          },
        ]
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
      bank_transfer_requests: {
        Row: {
          amount: number
          bank_account_id: string
          completed_at: string | null
          created_at: string | null
          currency: string
          id: string
          notes: string | null
          otp_code: string | null
          otp_expires_at: string | null
          otp_verified: boolean | null
          reference: string | null
          status: string
          transfer_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified?: boolean | null
          reference?: string | null
          status?: string
          transfer_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified?: boolean | null
          reference?: string | null
          status?: string
          transfer_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfer_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "user_linked_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      cms_banners: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          position: string
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          position?: string
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          position?: string
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          meta_description: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_description?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
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
      compliance_audit_log: {
        Row: {
          created_at: string
          driver_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          ip_address: string | null
          payload: Json
          ride_id: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          ip_address?: string | null
          payload?: Json
          ride_id?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          payload?: Json
          ride_id?: string | null
          zone_id?: string | null
        }
        Relationships: []
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
      demand_snapshots: {
        Row: {
          available_drivers: number
          avg_wait_time_mins: number | null
          created_at: string
          demand_ratio: number | null
          id: string
          pending_orders: number
          snapshot_time: string
          surge_multiplier: number
          zone_id: string | null
        }
        Insert: {
          available_drivers?: number
          avg_wait_time_mins?: number | null
          created_at?: string
          demand_ratio?: number | null
          id?: string
          pending_orders?: number
          snapshot_time?: string
          surge_multiplier?: number
          zone_id?: string | null
        }
        Update: {
          available_drivers?: number
          avg_wait_time_mins?: number | null
          created_at?: string
          demand_ratio?: number | null
          id?: string
          pending_orders?: number
          snapshot_time?: string
          surge_multiplier?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_snapshots_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "dispatch_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_assignments: {
        Row: {
          attempt_number: number | null
          completed_at: string | null
          created_at: string
          distance_to_pickup_km: number | null
          driver_id: string
          entity_id: string
          entity_type: string
          estimated_arrival_mins: number | null
          expires_at: string | null
          id: string
          match_score: number | null
          offered_at: string
          rejection_reason: string | null
          responded_at: string | null
          status: string
          surge_multiplier: number | null
        }
        Insert: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string
          distance_to_pickup_km?: number | null
          driver_id: string
          entity_id: string
          entity_type: string
          estimated_arrival_mins?: number | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          offered_at?: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          surge_multiplier?: number | null
        }
        Update: {
          attempt_number?: number | null
          completed_at?: string | null
          created_at?: string
          distance_to_pickup_km?: number | null
          driver_id?: string
          entity_id?: string
          entity_type?: string
          estimated_arrival_mins?: number | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          offered_at?: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          surge_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_batches: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          job_ids: string[]
          optimization_score: number | null
          route_order: number[] | null
          status: string
          total_distance_km: number | null
          total_earnings: number | null
          total_estimated_mins: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          job_ids?: string[]
          optimization_score?: number | null
          route_order?: number[] | null
          status?: string
          total_distance_km?: number | null
          total_earnings?: number | null
          total_estimated_mins?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          job_ids?: string[]
          optimization_score?: number | null
          route_order?: number[] | null
          status?: string
          total_distance_km?: number | null
          total_earnings?: number | null
          total_estimated_mins?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_batches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_events: {
        Row: {
          created_at: string
          driver_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_zones: {
        Row: {
          base_surge_multiplier: number
          center_lat: number
          center_lng: number
          created_at: string
          demand_weight: number
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          base_surge_multiplier?: number
          center_lat: number
          center_lng: number
          created_at?: string
          demand_weight?: number
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          base_surge_multiplier?: number
          center_lat?: number
          center_lng?: number
          created_at?: string
          demand_weight?: number
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
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
      driver_locations: {
        Row: {
          current_vehicle_id: string | null
          driver_id: string
          heading: number | null
          id: string
          is_available: boolean
          is_online: boolean
          last_updated: string
          latitude: number
          longitude: number
          speed: number | null
        }
        Insert: {
          current_vehicle_id?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          is_available?: boolean
          is_online?: boolean
          last_updated?: string
          latitude: number
          longitude: number
          speed?: number | null
        }
        Update: {
          current_vehicle_id?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          is_available?: boolean
          is_online?: boolean
          last_updated?: string
          latitude?: number
          longitude?: number
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_current_vehicle_id_fkey"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
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
      driver_risk_scores: {
        Row: {
          blocked_reason: string | null
          braking_factor: number
          cancellation_factor: number
          complaint_factor: number
          created_at: string
          driver_id: string
          id: string
          is_blocked: boolean
          last_evaluated_at: string
          overall_score: number
          rating_factor: number
          risk_level: string
          speed_factor: number
          updated_at: string
          violation_factor: number
        }
        Insert: {
          blocked_reason?: string | null
          braking_factor?: number
          cancellation_factor?: number
          complaint_factor?: number
          created_at?: string
          driver_id: string
          id?: string
          is_blocked?: boolean
          last_evaluated_at?: string
          overall_score?: number
          rating_factor?: number
          risk_level?: string
          speed_factor?: number
          updated_at?: string
          violation_factor?: number
        }
        Update: {
          blocked_reason?: string | null
          braking_factor?: number
          cancellation_factor?: number
          complaint_factor?: number
          created_at?: string
          driver_id?: string
          id?: string
          is_blocked?: boolean
          last_evaluated_at?: string
          overall_score?: number
          rating_factor?: number
          risk_level?: string
          speed_factor?: number
          updated_at?: string
          violation_factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_risk_scores_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
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
      driver_zone_licenses: {
        Row: {
          created_at: string
          driver_id: string
          expiry_date: string | null
          id: string
          issued_at: string
          permit_number: string | null
          status: string
          updated_at: string
          verified_by: string | null
          zone_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          expiry_date?: string | null
          id?: string
          issued_at?: string
          permit_number?: string | null
          status?: string
          updated_at?: string
          verified_by?: string | null
          zone_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          expiry_date?: string | null
          id?: string
          issued_at?: string
          permit_number?: string | null
          status?: string
          updated_at?: string
          verified_by?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_zone_licenses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_zone_licenses_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "ride_zones"
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
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_events: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          resolved_at: string | null
          resolved_by: string | null
          responder_notes: string | null
          role: string
          silent_mode: boolean
          status: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          responder_notes?: string | null
          role: string
          silent_mode?: boolean
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          responder_notes?: string | null
          role?: string
          silent_mode?: boolean
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      fleets: {
        Row: {
          active_vehicles: number
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          status: string
          total_vehicles: number
          updated_at: string
        }
        Insert: {
          active_vehicles?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          status?: string
          total_vehicles?: number
          updated_at?: string
        }
        Update: {
          active_vehicles?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          status?: string
          total_vehicles?: number
          updated_at?: string
        }
        Relationships: []
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
      gold_trades: {
        Row: {
          completed_at: string | null
          created_at: string
          fiat_amount: number
          fiat_currency: string
          gold_mg: number
          gold_price_per_mg_usd: number
          gold_price_snapshot_id: string | null
          id: string
          platform_fee: number
          spread_percent: number
          status: string
          trade_type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          fiat_amount: number
          fiat_currency?: string
          gold_mg: number
          gold_price_per_mg_usd: number
          gold_price_snapshot_id?: string | null
          id?: string
          platform_fee?: number
          spread_percent?: number
          status?: string
          trade_type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          fiat_amount?: number
          fiat_currency?: string
          gold_mg?: number
          gold_price_per_mg_usd?: number
          gold_price_snapshot_id?: string | null
          id?: string
          platform_fee?: number
          spread_percent?: number
          status?: string
          trade_type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gold_trades_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "platform_wallets"
            referencedColumns: ["id"]
          },
        ]
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
      influencer_ai_suggestions: {
        Row: {
          comment_id: string | null
          confidence: number | null
          created_at: string | null
          id: string
          influencer_id: string
          is_used: boolean | null
          suggested_text: string
          suggestion_type: string
          used_at: string | null
        }
        Insert: {
          comment_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          influencer_id: string
          is_used?: boolean | null
          suggested_text: string
          suggestion_type?: string
          used_at?: string | null
        }
        Update: {
          comment_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          influencer_id?: string
          is_used?: boolean | null
          suggested_text?: string
          suggestion_type?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_ai_suggestions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "influencer_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_ai_suggestions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_comments: {
        Row: {
          created_at: string | null
          id: string
          is_handled: boolean | null
          is_high_value: boolean | null
          is_replied: boolean | null
          is_spam: boolean | null
          metrics: Json | null
          parent_comment_id: string | null
          platform: string
          platform_comment_id: string
          post_id: string
          posted_at: string
          replied_at: string | null
          reply_text: string | null
          sentiment: string | null
          text: string
          user_avatar_url: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_handled?: boolean | null
          is_high_value?: boolean | null
          is_replied?: boolean | null
          is_spam?: boolean | null
          metrics?: Json | null
          parent_comment_id?: string | null
          platform: string
          platform_comment_id: string
          post_id: string
          posted_at: string
          replied_at?: string | null
          reply_text?: string | null
          sentiment?: string | null
          text: string
          user_avatar_url?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_handled?: boolean | null
          is_high_value?: boolean | null
          is_replied?: boolean | null
          is_spam?: boolean | null
          metrics?: Json | null
          parent_comment_id?: string | null
          platform?: string
          platform_comment_id?: string
          post_id?: string
          posted_at?: string
          replied_at?: string | null
          reply_text?: string | null
          sentiment?: string | null
          text?: string
          user_avatar_url?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "influencer_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "influencer_social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_conversions: {
        Row: {
          attribution_window_hours: number | null
          commission: number | null
          created_at: string | null
          event_type: string
          id: string
          influencer_id: string
          metadata: Json | null
          order_id: string | null
          platform: string
          post_id: string | null
          product_id: string | null
          revenue: number | null
        }
        Insert: {
          attribution_window_hours?: number | null
          commission?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          influencer_id: string
          metadata?: Json | null
          order_id?: string | null
          platform: string
          post_id?: string | null
          product_id?: string | null
          revenue?: number | null
        }
        Update: {
          attribution_window_hours?: number | null
          commission?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          influencer_id?: string
          metadata?: Json | null
          order_id?: string | null
          platform?: string
          post_id?: string | null
          product_id?: string | null
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_conversions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "influencer_social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_engagement_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          influencer_id: string
          likes: number | null
          metric_date: string
          platform: string
          post_id: string | null
          reach: number | null
          saves: number | null
          shares: number | null
          video_views: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          influencer_id: string
          likes?: number | null
          metric_date?: string
          platform: string
          post_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_views?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          influencer_id?: string
          likes?: number | null
          metric_date?: string
          platform?: string
          post_id?: string | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_engagement_metrics_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_engagement_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "influencer_social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_profiles: {
        Row: {
          assigned_by: string | null
          bio: string | null
          can_manage_accounts: boolean | null
          can_post: boolean | null
          can_schedule: boolean | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          id: string
          id_number: string | null
          is_active: boolean | null
          last_name: string | null
          performance_stats: Json | null
          phone: string | null
          platforms_access: string[] | null
          postal_code: string | null
          province: string | null
          street_address: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          assigned_by?: string | null
          bio?: string | null
          can_manage_accounts?: boolean | null
          can_post?: boolean | null
          can_schedule?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          last_name?: string | null
          performance_stats?: Json | null
          phone?: string | null
          platforms_access?: string[] | null
          postal_code?: string | null
          province?: string | null
          street_address?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          assigned_by?: string | null
          bio?: string | null
          can_manage_accounts?: boolean | null
          can_post?: boolean | null
          can_schedule?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          last_name?: string | null
          performance_stats?: Json | null
          phone?: string | null
          platforms_access?: string[] | null
          postal_code?: string | null
          province?: string | null
          street_address?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      influencer_revenue_analytics: {
        Row: {
          avg_engagement_rate: number | null
          created_at: string | null
          id: string
          influencer_id: string
          period_end: string
          period_start: string
          platform: string | null
          top_performing_post_id: string | null
          total_clicks: number | null
          total_commission: number | null
          total_conversions: number | null
          total_engagement: number | null
          total_posts: number | null
          total_revenue: number | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          created_at?: string | null
          id?: string
          influencer_id: string
          period_end: string
          period_start: string
          platform?: string | null
          top_performing_post_id?: string | null
          total_clicks?: number | null
          total_commission?: number | null
          total_conversions?: number | null
          total_engagement?: number | null
          total_posts?: number | null
          total_revenue?: number | null
        }
        Update: {
          avg_engagement_rate?: number | null
          created_at?: string | null
          id?: string
          influencer_id?: string
          period_end?: string
          period_start?: string
          platform?: string | null
          top_performing_post_id?: string | null
          total_clicks?: number | null
          total_commission?: number | null
          total_conversions?: number | null
          total_engagement?: number | null
          total_posts?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_revenue_analytics_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_revenue_analytics_top_performing_post_id_fkey"
            columns: ["top_performing_post_id"]
            isOneToOne: false
            referencedRelation: "influencer_social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_social_posts: {
        Row: {
          caption: string | null
          content_type: string
          created_at: string | null
          id: string
          influencer_id: string
          is_synced: boolean | null
          linked_product_id: string | null
          media_url: string | null
          media_urls: string[] | null
          metrics: Json | null
          permalink: string | null
          platform: string
          platform_post_id: string
          posted_at: string | null
          raw_data: Json | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          content_type?: string
          created_at?: string | null
          id?: string
          influencer_id: string
          is_synced?: boolean | null
          linked_product_id?: string | null
          media_url?: string | null
          media_urls?: string[] | null
          metrics?: Json | null
          permalink?: string | null
          platform: string
          platform_post_id: string
          posted_at?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          content_type?: string
          created_at?: string | null
          id?: string
          influencer_id?: string
          is_synced?: boolean | null
          linked_product_id?: string | null
          media_url?: string | null
          media_urls?: string[] | null
          metrics?: Json | null
          permalink?: string | null
          platform?: string
          platform_post_id?: string
          posted_at?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_social_posts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_social_posts_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_sync_status: {
        Row: {
          comments_synced: number | null
          created_at: string | null
          error_message: string | null
          id: string
          influencer_id: string
          last_sync_at: string | null
          platform: string
          posts_synced: number | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          comments_synced?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          influencer_id: string
          last_sync_at?: string | null
          platform: string
          posts_synced?: number | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          comments_synced?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          influencer_id?: string
          last_sync_at?: string | null
          platform?: string
          posts_synced?: number | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_sync_status_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      lease_applications: {
        Row: {
          applicant_email: string | null
          applicant_name: string | null
          applicant_phone: string | null
          asset_id: string
          created_at: string
          credit_score: number | null
          employment_status: string | null
          id: string
          id_document_url: string | null
          lease_duration_months: number
          monthly_income: number | null
          monthly_payment: number
          notes: string | null
          proof_of_income_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          security_deposit: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applicant_email?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          asset_id: string
          created_at?: string
          credit_score?: number | null
          employment_status?: string | null
          id?: string
          id_document_url?: string | null
          lease_duration_months?: number
          monthly_income?: number | null
          monthly_payment?: number
          notes?: string | null
          proof_of_income_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          security_deposit?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          asset_id?: string
          created_at?: string
          credit_score?: number | null
          employment_status?: string | null
          id?: string
          id_document_url?: string | null
          lease_duration_months?: number
          monthly_income?: number | null
          monthly_payment?: number
          notes?: string | null
          proof_of_income_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          security_deposit?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_applications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "leaseable_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_asset_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_asset_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lease_asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_contracts: {
        Row: {
          application_id: string | null
          asset_id: string
          auto_pay_enabled: boolean | null
          contract_document_url: string | null
          contract_number: string
          created_at: string
          deposit_returned: boolean | null
          e_signature_url: string | null
          end_date: string
          id: string
          insurance_active: boolean | null
          insurance_monthly_cost: number | null
          insurance_provider: string | null
          is_lease_to_own: boolean | null
          late_payments: number | null
          monthly_payment: number
          next_payment_date: string | null
          ownership_transfer_amount: number | null
          ownership_transferred: boolean | null
          payment_method_id: string | null
          payments_made: number | null
          payments_remaining: number | null
          renewal_count: number | null
          security_deposit: number | null
          signed_at: string | null
          start_date: string
          status: string
          terminated_at: string | null
          termination_reason: string | null
          total_due: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          asset_id: string
          auto_pay_enabled?: boolean | null
          contract_document_url?: string | null
          contract_number: string
          created_at?: string
          deposit_returned?: boolean | null
          e_signature_url?: string | null
          end_date: string
          id?: string
          insurance_active?: boolean | null
          insurance_monthly_cost?: number | null
          insurance_provider?: string | null
          is_lease_to_own?: boolean | null
          late_payments?: number | null
          monthly_payment: number
          next_payment_date?: string | null
          ownership_transfer_amount?: number | null
          ownership_transferred?: boolean | null
          payment_method_id?: string | null
          payments_made?: number | null
          payments_remaining?: number | null
          renewal_count?: number | null
          security_deposit?: number | null
          signed_at?: string | null
          start_date?: string
          status?: string
          terminated_at?: string | null
          termination_reason?: string | null
          total_due?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          asset_id?: string
          auto_pay_enabled?: boolean | null
          contract_document_url?: string | null
          contract_number?: string
          created_at?: string
          deposit_returned?: boolean | null
          e_signature_url?: string | null
          end_date?: string
          id?: string
          insurance_active?: boolean | null
          insurance_monthly_cost?: number | null
          insurance_provider?: string | null
          is_lease_to_own?: boolean | null
          late_payments?: number | null
          monthly_payment?: number
          next_payment_date?: string | null
          ownership_transfer_amount?: number | null
          ownership_transferred?: boolean | null
          payment_method_id?: string | null
          payments_made?: number | null
          payments_remaining?: number | null
          renewal_count?: number | null
          security_deposit?: number | null
          signed_at?: string | null
          start_date?: string
          status?: string
          terminated_at?: string | null
          termination_reason?: string | null
          total_due?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "lease_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "leaseable_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_credit_scores: {
        Row: {
          created_at: string
          delivery_reliability_score: number | null
          factors: Json | null
          id: string
          last_calculated_at: string | null
          max_lease_value: number | null
          on_time_rate: number | null
          order_history_score: number | null
          overall_score: number
          payment_history_score: number | null
          platform_tenure_score: number | null
          ride_performance_score: number | null
          risk_level: string
          total_deliveries: number | null
          total_orders: number | null
          total_rides: number | null
          updated_at: string
          user_id: string
          wallet_activity_score: number | null
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string
          delivery_reliability_score?: number | null
          factors?: Json | null
          id?: string
          last_calculated_at?: string | null
          max_lease_value?: number | null
          on_time_rate?: number | null
          order_history_score?: number | null
          overall_score?: number
          payment_history_score?: number | null
          platform_tenure_score?: number | null
          ride_performance_score?: number | null
          risk_level?: string
          total_deliveries?: number | null
          total_orders?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id: string
          wallet_activity_score?: number | null
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string
          delivery_reliability_score?: number | null
          factors?: Json | null
          id?: string
          last_calculated_at?: string | null
          max_lease_value?: number | null
          on_time_rate?: number | null
          order_history_score?: number | null
          overall_score?: number
          payment_history_score?: number | null
          platform_tenure_score?: number | null
          ride_performance_score?: number | null
          risk_level?: string
          total_deliveries?: number | null
          total_orders?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          wallet_activity_score?: number | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      lease_insurance: {
        Row: {
          claim_count: number | null
          contract_id: string
          coverage_amount: number
          coverage_type: string | null
          created_at: string
          end_date: string | null
          id: string
          monthly_premium: number
          policy_number: string | null
          provider: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_count?: number | null
          contract_id: string
          coverage_amount?: number
          coverage_type?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_premium?: number
          policy_number?: string | null
          provider: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_count?: number | null
          contract_id?: string
          coverage_amount?: number
          coverage_type?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_premium?: number
          policy_number?: string | null
          provider?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_insurance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          late_fee: number | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_type: string
          status: string
          transaction_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          late_fee?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string
          status?: string
          transaction_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          late_fee?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string
          status?: string
          transaction_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_revenue_splits: {
        Row: {
          contract_id: string
          created_at: string
          financier_amount: number | null
          id: string
          insurance_amount: number | null
          owner_amount: number
          payment_id: string | null
          platform_amount: number
          processed_at: string | null
          status: string
          total_amount: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          financier_amount?: number | null
          id?: string
          insurance_amount?: number | null
          owner_amount?: number
          payment_id?: string | null
          platform_amount?: number
          processed_at?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          financier_amount?: number | null
          id?: string
          insurance_amount?: number | null
          owner_amount?: number
          payment_id?: string | null
          platform_amount?: number
          processed_at?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lease_revenue_splits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_revenue_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "lease_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      leaseable_assets: {
        Row: {
          accumulated_payments: number | null
          asset_year: number | null
          brand: string | null
          category: string
          condition: string | null
          created_at: string
          description: string | null
          featured: boolean | null
          id: string
          images: string[] | null
          insurance_monthly_cost: number | null
          insurance_provider: string | null
          insurance_required: boolean | null
          is_available: boolean | null
          is_purchasable: boolean | null
          lease_category_id: string | null
          lease_price_daily: number | null
          lease_price_monthly: number
          lease_price_weekly: number | null
          lease_to_own: boolean | null
          lease_to_own_months: number | null
          lease_to_own_price: number | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          maintenance_requirements: string | null
          maintenance_responsibility: string | null
          max_lease_duration_months: number | null
          min_lease_duration_months: number | null
          model: string | null
          product_id: string | null
          provider_id: string | null
          purchase_price: number | null
          rating: number | null
          review_count: number | null
          security_deposit: number | null
          serial_number: string | null
          status: string
          subcategory: string | null
          terms_and_conditions: string | null
          title: string
          total_leases: number | null
          updated_at: string
          views_count: number | null
        }
        Insert: {
          accumulated_payments?: number | null
          asset_year?: number | null
          brand?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          images?: string[] | null
          insurance_monthly_cost?: number | null
          insurance_provider?: string | null
          insurance_required?: boolean | null
          is_available?: boolean | null
          is_purchasable?: boolean | null
          lease_category_id?: string | null
          lease_price_daily?: number | null
          lease_price_monthly?: number
          lease_price_weekly?: number | null
          lease_to_own?: boolean | null
          lease_to_own_months?: number | null
          lease_to_own_price?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          maintenance_requirements?: string | null
          maintenance_responsibility?: string | null
          max_lease_duration_months?: number | null
          min_lease_duration_months?: number | null
          model?: string | null
          product_id?: string | null
          provider_id?: string | null
          purchase_price?: number | null
          rating?: number | null
          review_count?: number | null
          security_deposit?: number | null
          serial_number?: string | null
          status?: string
          subcategory?: string | null
          terms_and_conditions?: string | null
          title: string
          total_leases?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          accumulated_payments?: number | null
          asset_year?: number | null
          brand?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          images?: string[] | null
          insurance_monthly_cost?: number | null
          insurance_provider?: string | null
          insurance_required?: boolean | null
          is_available?: boolean | null
          is_purchasable?: boolean | null
          lease_category_id?: string | null
          lease_price_daily?: number | null
          lease_price_monthly?: number
          lease_price_weekly?: number | null
          lease_to_own?: boolean | null
          lease_to_own_months?: number | null
          lease_to_own_price?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          maintenance_requirements?: string | null
          maintenance_responsibility?: string | null
          max_lease_duration_months?: number | null
          min_lease_duration_months?: number | null
          model?: string | null
          product_id?: string | null
          provider_id?: string | null
          purchase_price?: number | null
          rating?: number | null
          review_count?: number | null
          security_deposit?: number | null
          serial_number?: string | null
          status?: string
          subcategory?: string | null
          terms_and_conditions?: string | null
          title?: string
          total_leases?: number | null
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaseable_assets_lease_category_id_fkey"
            columns: ["lease_category_id"]
            isOneToOne: false
            referencedRelation: "lease_asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaseable_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaseable_assets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "asset_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_bookings: {
        Row: {
          check_in: string
          check_out: string
          created_at: string | null
          guests: number | null
          id: string
          payment_status: string | null
          property_id: string
          special_requests: string | null
          status: string | null
          total_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string | null
          guests?: number | null
          id?: string
          payment_status?: string | null
          property_id: string
          special_requests?: string | null
          status?: string | null
          total_price?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string | null
          guests?: number | null
          id?: string
          payment_status?: string | null
          property_id?: string
          special_requests?: string | null
          status?: string | null
          total_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "lodging_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_properties: {
        Row: {
          address: string | null
          amenities: Json | null
          bathrooms: number | null
          bedrooms: number | null
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          images: Json | null
          is_active: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          max_guests: number | null
          name: string
          owner_id: string
          price_per_night: number
          province: string | null
          rating: number | null
          review_count: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          max_guests?: number | null
          name: string
          owner_id: string
          price_per_night?: number
          province?: string | null
          rating?: number | null
          review_count?: number | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          max_guests?: number | null
          name?: string
          owner_id?: string
          price_per_night?: number
          province?: string | null
          rating?: number | null
          review_count?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lodging_properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string | null
          id: string
          property_id: string
          rating: number
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          property_id: string
          rating: number
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          property_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "lodging_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "lodging_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_api_keys: {
        Row: {
          api_key: string
          api_secret_hash: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          rate_limit_per_hour: number | null
          scopes: string[] | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          api_key: string
          api_secret_hash: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          rate_limit_per_hour?: number | null
          scopes?: string[] | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          api_key?: string
          api_secret_hash?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          rate_limit_per_hour?: number | null
          scopes?: string[] | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_keys_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_api_logs: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          ssl_status: string | null
          status: string
          store_id: string | null
          updated_at: string
          vendor_id: string
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          ssl_status?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          vendor_id: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          ssl_status?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          vendor_id?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_custom_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_custom_domains_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          document_url: string
          file_name: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url: string
          file_name?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string
          file_name?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_kyc_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      platform_wallets: {
        Row: {
          balance_zar: number
          created_at: string
          gold_balance_mg: number
          id: string
          is_verified: boolean
          lifetime_deposited: number
          lifetime_earned: number
          lifetime_gold_bought_mg: number
          lifetime_gold_sold_mg: number
          lifetime_spent: number
          lifetime_withdrawn: number
          pending_balance_zar: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_zar?: number
          created_at?: string
          gold_balance_mg?: number
          id?: string
          is_verified?: boolean
          lifetime_deposited?: number
          lifetime_earned?: number
          lifetime_gold_bought_mg?: number
          lifetime_gold_sold_mg?: number
          lifetime_spent?: number
          lifetime_withdrawn?: number
          pending_balance_zar?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_zar?: number
          created_at?: string
          gold_balance_mg?: number
          id?: string
          is_verified?: boolean
          lifetime_deposited?: number
          lifetime_earned?: number
          lifetime_gold_bought_mg?: number
          lifetime_gold_sold_mg?: number
          lifetime_spent?: number
          lifetime_withdrawn?: number
          pending_balance_zar?: number
          updated_at?: string
          user_id?: string
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
          listing_type: string
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
          listing_type?: string
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
          listing_type?: string
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
          is_banned: boolean | null
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
          is_banned?: boolean | null
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
          is_banned?: boolean | null
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
      ride_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          ride_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          ride_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_status_history_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_zones: {
        Row: {
          center_lat: number
          center_lng: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          municipality: string | null
          name: string
          polygon: Json
          province: string | null
          radius_km: number
          severity: number
          updated_at: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          municipality?: string | null
          name: string
          polygon?: Json
          province?: string | null
          radius_km?: number
          severity?: number
          updated_at?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          municipality?: string | null
          name?: string
          polygon?: Json
          province?: string | null
          radius_km?: number
          severity?: number
          updated_at?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          accepted_at: string | null
          actual_distance_km: number | null
          actual_duration_minutes: number | null
          actual_fare: number | null
          arrived_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_latitude: number | null
          dropoff_lng: number | null
          dropoff_longitude: number | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          estimated_fare: number | null
          feedback_by_driver: string | null
          feedback_by_passenger: string | null
          id: string
          passenger_id: string
          payment_method: string
          payment_status: string
          pickup_address: string
          pickup_lat: number | null
          pickup_latitude: number | null
          pickup_lng: number | null
          pickup_longitude: number | null
          rating_by_driver: number | null
          rating_by_passenger: number | null
          requested_at: string
          started_at: string | null
          status: string
          surge_multiplier: number
          updated_at: string
          vehicle_id: string | null
          vehicle_type_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          actual_fare?: number | null
          arrived_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_latitude?: number | null
          dropoff_lng?: number | null
          dropoff_longitude?: number | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_fare?: number | null
          feedback_by_driver?: string | null
          feedback_by_passenger?: string | null
          id?: string
          passenger_id: string
          payment_method?: string
          payment_status?: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_latitude?: number | null
          pickup_lng?: number | null
          pickup_longitude?: number | null
          rating_by_driver?: number | null
          rating_by_passenger?: number | null
          requested_at?: string
          started_at?: string | null
          status?: string
          surge_multiplier?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          actual_fare?: number | null
          arrived_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_latitude?: number | null
          dropoff_lng?: number | null
          dropoff_longitude?: number | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_fare?: number | null
          feedback_by_driver?: string | null
          feedback_by_passenger?: string | null
          id?: string
          passenger_id?: string
          payment_method?: string
          payment_status?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_latitude?: number | null
          pickup_lng?: number | null
          pickup_longitude?: number | null
          rating_by_driver?: number | null
          rating_by_passenger?: number | null
          requested_at?: string
          started_at?: string | null
          status?: string
          surge_multiplier?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          driver_id: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          passenger_id: string | null
          payload: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          ride_id: string | null
          severity: string
          status: string
          trigger_source: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          driver_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          passenger_id?: string | null
          payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          severity?: string
          status?: string
          trigger_source?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          passenger_id?: string | null
          payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          severity?: string
          status?: string
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      service_modules: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_name: string
          icon: string
          id: string
          is_active: boolean
          name: string
          required_role: string | null
          route: string
          sort_order: number
        }
        Insert: {
          color: string
          created_at?: string
          description?: string | null
          display_name: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          required_role?: string | null
          route: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          required_role?: string | null
          route?: string
          sort_order?: number
        }
        Relationships: []
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
      social_media_posts: {
        Row: {
          content: string
          content_type: string
          created_at: string
          created_by: string
          engagement_stats: Json | null
          external_post_ids: Json | null
          external_post_url: string | null
          id: string
          media_urls: string[] | null
          platforms: string[]
          product_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          content_type?: string
          created_at?: string
          created_by: string
          engagement_stats?: Json | null
          external_post_ids?: Json | null
          external_post_url?: string | null
          id?: string
          media_urls?: string[] | null
          platforms?: string[]
          product_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string
          created_by?: string
          engagement_stats?: Json | null
          external_post_ids?: Json | null
          external_post_url?: string | null
          id?: string
          media_urls?: string[] | null
          platforms?: string[]
          product_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      social_oauth_tokens: {
        Row: {
          access_token: string
          account_handle: string | null
          account_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          page_access_token: string | null
          page_id: string | null
          page_name: string | null
          platform: string
          refresh_token: string | null
          scope: string[] | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_handle?: string | null
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          platform: string
          refresh_token?: string | null
          scope?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_handle?: string | null
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          page_access_token?: string | null
          page_id?: string | null
          page_name?: string | null
          platform?: string
          refresh_token?: string | null
          scope?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_post_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          created_at: string
          engagement_rate: number | null
          external_post_id: string | null
          fetched_at: string
          id: string
          impressions: number | null
          likes: number | null
          platform: string
          post_id: string
          raw_data: Json | null
          reach: number | null
          shares: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          external_post_id?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          platform: string
          post_id: string
          raw_data?: Json | null
          reach?: number | null
          shares?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          external_post_id?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          platform?: string
          post_id?: string
          raw_data?: Json | null
          reach?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_platforms: {
        Row: {
          created_at: string
          error_message: string | null
          external_post_id: string | null
          external_post_url: string | null
          id: string
          platform: string
          post_id: string
          published_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          id?: string
          platform: string
          post_id: string
          published_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          id?: string
          platform?: string
          post_id?: string
          published_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_platforms_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
            referencedColumns: ["id"]
          },
        ]
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
      store_featured_products: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          product_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          product_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          product_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_featured_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_customizations: {
        Row: {
          about_us: string | null
          accent_color: string | null
          announcement_bar_active: boolean | null
          announcement_bar_text: string | null
          created_at: string
          cta_button_text: string | null
          cta_button_url: string | null
          custom_css: string | null
          custom_domain: string | null
          custom_font: string | null
          custom_meta_description: string | null
          custom_meta_title: string | null
          email_capture_enabled: boolean | null
          email_capture_title: string | null
          faq_items: Json | null
          ga_tracking_id: string | null
          homepage_sections: Json | null
          id: string
          layout_type: string | null
          mega_menu_config: Json | null
          meta_pixel_id: string | null
          secondary_color: string | null
          social_links: Json | null
          store_id: string
          testimonials: Json | null
          updated_at: string
          video_banner_url: string | null
          white_label: boolean | null
        }
        Insert: {
          about_us?: string | null
          accent_color?: string | null
          announcement_bar_active?: boolean | null
          announcement_bar_text?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_button_url?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          custom_font?: string | null
          custom_meta_description?: string | null
          custom_meta_title?: string | null
          email_capture_enabled?: boolean | null
          email_capture_title?: string | null
          faq_items?: Json | null
          ga_tracking_id?: string | null
          homepage_sections?: Json | null
          id?: string
          layout_type?: string | null
          mega_menu_config?: Json | null
          meta_pixel_id?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          store_id: string
          testimonials?: Json | null
          updated_at?: string
          video_banner_url?: string | null
          white_label?: boolean | null
        }
        Update: {
          about_us?: string | null
          accent_color?: string | null
          announcement_bar_active?: boolean | null
          announcement_bar_text?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_button_url?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          custom_font?: string | null
          custom_meta_description?: string | null
          custom_meta_title?: string | null
          email_capture_enabled?: boolean | null
          email_capture_title?: string | null
          faq_items?: Json | null
          ga_tracking_id?: string | null
          homepage_sections?: Json | null
          id?: string
          layout_type?: string | null
          mega_menu_config?: Json | null
          meta_pixel_id?: string | null
          secondary_color?: string | null
          social_links?: Json | null
          store_id?: string
          testimonials?: Json | null
          updated_at?: string
          video_banner_url?: string | null
          white_label?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_customizations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
      subscription_payments: {
        Row: {
          amount: number
          billing_period: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payfast_payment_id: string | null
          payment_method: string
          reference: string | null
          status: string
          tier: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          billing_period?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payfast_payment_id?: string | null
          payment_method: string
          reference?: string | null
          status?: string
          tier: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          billing_period?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payfast_payment_id?: string | null
          payment_method?: string
          reference?: string | null
          status?: string
          tier?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          admin_response: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          admin_response?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
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
      trip_pins: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          pin_code: string
          ride_id: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          pin_code: string
          ride_id: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          pin_code?: string
          ride_id?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_pins_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
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
      user_linked_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number_hash: string
          account_number_masked: string
          account_type: string
          bank_name: string
          branch_code: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          account_holder_name: string
          account_number_hash: string
          account_number_masked: string
          account_type?: string
          bank_name: string
          branch_code?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number_hash?: string
          account_number_masked?: string
          account_type?: string
          bank_name?: string
          branch_code?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
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
      vehicle_types: {
        Row: {
          base_fare: number
          created_at: string
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean
          max_passengers: number
          minimum_fare: number
          name: string
          per_km_rate: number
          per_minute_rate: number
        }
        Insert: {
          base_fare?: number
          created_at?: string
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean
          max_passengers?: number
          minimum_fare?: number
          name: string
          per_km_rate?: number
          per_minute_rate?: number
        }
        Update: {
          base_fare?: number
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          max_passengers?: number
          minimum_fare?: number
          name?: string
          per_km_rate?: number
          per_minute_rate?: number
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string
          created_at: string
          documents: Json | null
          driver_id: string | null
          fleet_id: string | null
          id: string
          inspection_status: string | null
          insurance_expiry: string | null
          is_fleet_vehicle: boolean
          license_plate: string
          make: string
          model: string
          registration_expiry: string | null
          status: string
          updated_at: string
          vehicle_type_id: string | null
          vin_number: string | null
          year: number
        }
        Insert: {
          color: string
          created_at?: string
          documents?: Json | null
          driver_id?: string | null
          fleet_id?: string | null
          id?: string
          inspection_status?: string | null
          insurance_expiry?: string | null
          is_fleet_vehicle?: boolean
          license_plate: string
          make: string
          model: string
          registration_expiry?: string | null
          status?: string
          updated_at?: string
          vehicle_type_id?: string | null
          vin_number?: string | null
          year: number
        }
        Update: {
          color?: string
          created_at?: string
          documents?: Json | null
          driver_id?: string | null
          fleet_id?: string | null
          id?: string
          inspection_status?: string | null
          insurance_expiry?: string | null
          is_fleet_vehicle?: boolean
          license_plate?: string
          make?: string
          model?: string
          registration_expiry?: string | null
          status?: string
          updated_at?: string
          vehicle_type_id?: string | null
          vin_number?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_fleet_id_fkey"
            columns: ["fleet_id"]
            isOneToOne: false
            referencedRelation: "fleets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
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
      vendor_subscription_audit_log: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          id: string
          new_status: string | null
          new_tier: string | null
          old_status: string | null
          old_tier: string | null
          reason: string | null
          vendor_id: string
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string
          id?: string
          new_status?: string | null
          new_tier?: string | null
          old_status?: string | null
          old_tier?: string | null
          reason?: string | null
          vendor_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string | null
          new_tier?: string | null
          old_status?: string | null
          old_tier?: string | null
          reason?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscription_audit_log_vendor_id_fkey"
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
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_routing_code: string | null
          business_address: string | null
          business_email: string | null
          business_name: string
          business_phone: string | null
          business_type: string | null
          commission_rate: number | null
          created_at: string
          custom_markup_percentage: number | null
          default_pricing_currency: string | null
          description: string | null
          features_config: Json | null
          fee_agreement_accepted: boolean | null
          id: string
          legal_business_name: string | null
          logo_url: string | null
          monthly_promotions_limit: number | null
          monthly_promotions_used: number | null
          onboarding_completed_at: string | null
          onboarding_status: string
          payout_days: number | null
          payout_schedule: string | null
          platform_balance: number | null
          return_policy: string | null
          search_boost: number | null
          shipping_methods: string[] | null
          shipping_regions: string[] | null
          status: string
          subscription_auto_renew: boolean | null
          subscription_expires_at: string | null
          subscription_next_billing_date: string | null
          subscription_payment_method: string | null
          subscription_status: string | null
          subscription_tier: string | null
          tax_id: string | null
          tier_id: string | null
          tier_updated_at: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
          vat_registered: boolean | null
          website: string | null
        }
        Insert: {
          ad_credits?: number | null
          approval_date?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_routing_code?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name: string
          business_phone?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          custom_markup_percentage?: number | null
          default_pricing_currency?: string | null
          description?: string | null
          features_config?: Json | null
          fee_agreement_accepted?: boolean | null
          id?: string
          legal_business_name?: string | null
          logo_url?: string | null
          monthly_promotions_limit?: number | null
          monthly_promotions_used?: number | null
          onboarding_completed_at?: string | null
          onboarding_status?: string
          payout_days?: number | null
          payout_schedule?: string | null
          platform_balance?: number | null
          return_policy?: string | null
          search_boost?: number | null
          shipping_methods?: string[] | null
          shipping_regions?: string[] | null
          status?: string
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_next_billing_date?: string | null
          subscription_payment_method?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tier_id?: string | null
          tier_updated_at?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
          vat_registered?: boolean | null
          website?: string | null
        }
        Update: {
          ad_credits?: number | null
          approval_date?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_routing_code?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string
          business_phone?: string | null
          business_type?: string | null
          commission_rate?: number | null
          created_at?: string
          custom_markup_percentage?: number | null
          default_pricing_currency?: string | null
          description?: string | null
          features_config?: Json | null
          fee_agreement_accepted?: boolean | null
          id?: string
          legal_business_name?: string | null
          logo_url?: string | null
          monthly_promotions_limit?: number | null
          monthly_promotions_used?: number | null
          onboarding_completed_at?: string | null
          onboarding_status?: string
          payout_days?: number | null
          payout_schedule?: string | null
          platform_balance?: number | null
          return_policy?: string | null
          search_boost?: number | null
          shipping_methods?: string[] | null
          shipping_regions?: string[] | null
          status?: string
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_next_billing_date?: string | null
          subscription_payment_method?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tax_id?: string | null
          tier_id?: string | null
          tier_updated_at?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          vat_registered?: boolean | null
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
      wallet_transactions: {
        Row: {
          amount: number
          asset_type: string
          completed_at: string | null
          counterparty_id: string | null
          created_at: string
          currency: string
          description: string | null
          fee: number
          id: string
          metadata: Json | null
          net_amount: number
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          asset_type?: string
          completed_at?: string | null
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          fee?: number
          id?: string
          metadata?: Json | null
          net_amount: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          asset_type?: string
          completed_at?: string | null
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          fee?: number
          id?: string
          metadata?: Json | null
          net_amount?: number
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "platform_wallets"
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
      zone_access_passes: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          is_active: boolean
          pass_type: string
          payment_status: string
          price_zar: number
          valid_from: string
          valid_to: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          is_active?: boolean
          pass_type?: string
          payment_status?: string
          price_zar?: number
          valid_from?: string
          valid_to: string
          zone_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          is_active?: boolean
          pass_type?: string
          payment_status?: string
          price_zar?: number
          valid_from?: string
          valid_to?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_access_passes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_access_passes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "ride_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_fines: {
        Row: {
          amount_zar: number
          base_fine: number
          created_at: string
          deducted_at: string | null
          demand_multiplier: number
          driver_id: string
          id: string
          repeat_multiplier: number
          severity_multiplier: number
          status: string
          violation_id: string
        }
        Insert: {
          amount_zar: number
          base_fine?: number
          created_at?: string
          deducted_at?: string | null
          demand_multiplier?: number
          driver_id: string
          id?: string
          repeat_multiplier?: number
          severity_multiplier?: number
          status?: string
          violation_id: string
        }
        Update: {
          amount_zar?: number
          base_fine?: number
          created_at?: string
          deducted_at?: string | null
          demand_multiplier?: number
          driver_id?: string
          id?: string
          repeat_multiplier?: number
          severity_multiplier?: number
          status?: string
          violation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_fines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_fines_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "zone_violations"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_violations: {
        Row: {
          created_at: string
          detected_zone: string | null
          driver_id: string
          id: string
          licensed_zones: string[] | null
          location_lat: number | null
          location_lng: number | null
          ride_id: string | null
          severity: number
          status: string
          violation_type: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          detected_zone?: string | null
          driver_id: string
          id?: string
          licensed_zones?: string[] | null
          location_lat?: number | null
          location_lng?: number | null
          ride_id?: string | null
          severity?: number
          status?: string
          violation_type?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          detected_zone?: string | null
          driver_id?: string
          id?: string
          licensed_zones?: string[] | null
          location_lat?: number | null
          location_lng?: number | null
          ride_id?: string | null
          severity?: number
          status?: string
          violation_type?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_violations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_violations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_violations_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "ride_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_zone_fine: { Args: { p_violation_id: string }; Returns: number }
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
      calculate_lease_credit_score: {
        Args: { p_user_id: string }
        Returns: Json
      }
      calculate_ride_fare: {
        Args: {
          p_distance_km: number
          p_duration_minutes: number
          p_surge_multiplier?: number
          p_vehicle_type_id: string
        }
        Returns: number
      }
      calculate_zone_surge: { Args: { p_zone_id: string }; Returns: number }
      can_vendor_add_product: {
        Args: { p_vendor_id: string }
        Returns: boolean
      }
      can_vendor_create_promotion: {
        Args: { p_vendor_id: string }
        Returns: boolean
      }
      check_and_award_badges: { Args: { p_user_id: string }; Returns: number }
      check_driver_zone_compliance: {
        Args: { p_driver_id: string; p_lat: number; p_lng: number }
        Returns: Json
      }
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
      delete_vendor_cascade: {
        Args: { vendor_uuid: string }
        Returns: undefined
      }
      evaluate_driver_risk: { Args: { p_driver_id: string }; Returns: Json }
      evaluate_driver_tier: { Args: { p_driver_id: string }; Returns: string }
      generate_api_key: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_trip_pin: { Args: { p_ride_id: string }; Returns: string }
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
      get_or_create_wallet: { Args: { p_user_id: string }; Returns: string }
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
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
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
      process_referral_purchase: {
        Args: {
          p_order_amount: number
          p_order_id: string
          p_referred_id: string
        }
        Returns: boolean
      }
      process_referral_signup: {
        Args: { p_referral_code: string; p_referred_id: string }
        Returns: boolean
      }
      reset_demo_data: { Args: { p_scopes: string[] }; Returns: Json }
      score_driver_for_dispatch: {
        Args: {
          p_driver_id: string
          p_entity_type?: string
          p_pickup_lat: number
          p_pickup_lng: number
        }
        Returns: number
      }
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
      verify_mining_completion: {
        Args: {
          p_completion_id: string
          p_rejection_reason?: string
          p_verified: boolean
          p_verified_by?: string
        }
        Returns: Json
      }
      verify_mining_task_from_approved_source: {
        Args: {
          p_completion_id: string
          p_rejection_reason?: string
          p_verified: boolean
          p_verified_by?: string
        }
        Returns: Json
      }
      verify_trip_pin: {
        Args: { p_pin: string; p_ride_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "consumer"
        | "vendor"
        | "admin"
        | "driver"
        | "influencer"
        | "passenger"
        | "fleet_manager"
        | "service_provider"
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
      app_role: [
        "consumer",
        "vendor",
        "admin",
        "driver",
        "influencer",
        "passenger",
        "fleet_manager",
        "service_provider",
      ],
    },
  },
} as const
