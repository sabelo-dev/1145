
export interface AdminUser {
  id: string;
  name?: string;
  email: string;
  role: 'consumer' | 'vendor' | 'admin';
  status?: 'active' | 'suspended' | 'pending';
  createdAt: string;
}

export interface AdminVendor {
  id: string;
  businessName: string;
  email: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  logoUrl?: string;
  description?: string;
  createdAt: string;
  userId: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  vendorName: string;
  price: number;
  status: "approved" | "pending" | "rejected";
  category: string;
  subcategory?: string;
  dateAdded: string;
  storeId: string;
  externalId?: string;
  externalSource?: string;
  inventoryQuantity?: number;
  sku?: string;
}

export interface AdminOrder {
  id: string;
  customerName: string;
  date: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  items: number;
}
