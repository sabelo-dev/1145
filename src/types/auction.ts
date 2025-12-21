export interface Auction {
  id: string;
  product_id: string;
  vendor_base_amount: number;
  starting_bid_price: number | null;
  current_bid: number | null;
  registration_fee: number;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'approved' | 'active' | 'ended' | 'sold' | 'unsold';
  winner_id: string | null;
  winning_bid: number | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    store_id: string;
    product_images?: { image_url: string }[];
    stores?: {
      name: string;
      vendor_id: string;
      vendors?: {
        business_name: string;
        user_id: string;
      };
    };
  };
}

export interface AuctionRegistration {
  id: string;
  auction_id: string;
  user_id: string;
  registration_fee_paid: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  is_winner: boolean;
  deposit_applied: boolean;
  created_at: string;
  profiles?: {
    name: string | null;
    email: string;
  };
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
  profiles?: {
    name: string | null;
    email: string;
  };
}
