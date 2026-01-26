
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  role: 'consumer' | 'vendor' | 'admin' | 'driver' | 'influencer';
}

export interface Profile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: 'consumer' | 'vendor' | 'admin' | 'driver' | 'influencer';
  created_at: string;
  updated_at: string;
}

export interface ProductVariation {
  id: string;
  productId: string;
  sku?: string;
  price: number;
  quantity: number;
  attributes: Record<string, string>; // e.g., { color: "Red", size: "M" }
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  subcategory?: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  vendorId: string;
  vendorName: string;
  vendorSlug?: string;
  createdAt: string;
  variations?: ProductVariation[];
  productType?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  subcategories?: { id: string; name: string; slug: string }[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  variationId?: string;
  variationAttributes?: Record<string, string>;
  productType?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
}

export interface Address {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
