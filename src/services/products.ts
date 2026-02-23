import { supabase } from "@/integrations/supabase/client";
import { Product, Category } from "@/types";

/**
 * Converts database product to frontend Product type
 */
const mapDatabaseProduct = (dbProduct: any, images: any[] = [], variations: any[] = []): Product => {
  const store = dbProduct.stores || {};
  const vendor = store.vendors || {};
  
  const mappedVariations = variations.map(v => ({
    id: v.id,
    productId: v.product_id,
    sku: v.sku,
    price: Number(v.price),
    quantity: v.quantity,
    attributes: v.attributes || {},
    imageUrl: v.image_url,
  }));
  
  // Calculate total stock including variations
  const totalStock = dbProduct.quantity + variations.reduce((sum, v) => sum + (v.quantity || 0), 0);
  
  // Sort images by position
  const sortedImages = [...images].sort((a, b) => a.position - b.position);
  
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    slug: dbProduct.slug,
    description: dbProduct.description || "",
    price: Number(dbProduct.price),
    compareAtPrice: dbProduct.compare_at_price ? Number(dbProduct.compare_at_price) : undefined,
    images: sortedImages.map(img => img.image_url),
    category: dbProduct.category,
    subcategory: dbProduct.subcategory,
    rating: Number(dbProduct.rating) || 0,
    reviewCount: dbProduct.review_count || 0,
    inStock: totalStock > 0,
    vendorId: store.id,
    vendorName: store.name || vendor.business_name || "Store",
    vendorSlug: store.slug,
    createdAt: dbProduct.created_at,
    variations: mappedVariations.length > 0 ? mappedVariations : undefined,
    productType: dbProduct.product_type,
  };
};

/**
 * Fetches products from the database
 */
export const fetchDatabaseProducts = async (): Promise<Product[]> => {
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_images (
          image_url,
          position
        ),
        product_variations (
          id,
          product_id,
          sku,
          price,
          quantity,
          attributes,
          image_url
        ),
        stores (
          id,
          name,
          slug,
          vendors (
            id,
            business_name
          )
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching database products:', productsError);
      return [];
    }

    return (products || []).map(product => 
      mapDatabaseProduct(
        product, 
        product.product_images || [],
        product.product_variations || []
      )
    );
  } catch (error) {
    console.error('Error fetching database products:', error);
    return [];
  }
};

/**
 * Fetches products by vendor store slug
 */
export const fetchProductsByStore = async (storeSlug: string): Promise<Product[]> => {
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_images (
          image_url,
          position
        ),
        product_variations (
          id,
          product_id,
          sku,
          price,
          quantity,
          attributes,
          image_url
        ),
        stores!inner (
          id,
          name,
          slug,
          vendors (
            id,
            business_name
          )
        )
      `)
      .eq('stores.slug', storeSlug)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products by store:', productsError);
      return [];
    }

    return (products || []).map(product => 
      mapDatabaseProduct(
        product, 
        product.product_images || [],
        product.product_variations || []
      )
    );
  } catch (error) {
    console.error('Error fetching products by store:', error);
    return [];
  }
};

/**
 * Fetches store information by slug
 */
export const fetchStoreBySlug = async (storeSlug: string) => {
  try {
    const { data: store, error } = await supabase
      .from('stores')
      .select(`
        *,
        vendors (
          id,
          business_name,
          description,
          logo_url,
          subscription_tier
        )
      `)
      .eq('slug', storeSlug)
      .maybeSingle();

    if (error) {
      console.error('Error fetching store:', error);
      return null;
    }

    return store;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
  }
};

/**
 * Fetches all products from database
 */
export const fetchAllProducts = async (): Promise<Product[]> => {
  try {
    return await fetchDatabaseProducts();
  } catch (error) {
    console.error('Error fetching all products:', error);
    return [];
  }
};

/**
 * Fetches categories from database
 * @param filterByProducts - If true, only returns categories with approved products (default: false)
 */
export const fetchCategories = async (filterByProducts: boolean = false): Promise<Category[]> => {
  try {
    // Get all active categories
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        *,
        subcategories (
          id,
          name,
          slug,
          description
        )
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories from database:', categoriesError);
      return [];
    }

    let categoriesToReturn = categoriesData || [];

    // Only filter by products if requested (for consumer-facing pages)
    if (filterByProducts) {
      const filteredCategories = [];
      
      for (const category of categoriesData || []) {
        // Check if this category has any approved products
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id')
          .eq('category', category.name)
          .in('status', ['approved', 'active'])
          .limit(1);

        if (!productsError && products && products.length > 0) {
          filteredCategories.push(category);
        }
      }
      
      categoriesToReturn = filteredCategories;
    }

    return categoriesToReturn.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image_url || `https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60`,
      subcategories: (category.subcategories || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
      })),
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

/**
 * Fetches subcategories for a specific category
 */
export const fetchSubcategoriesByCategory = async (categoryId: string): Promise<any[]> => {
  try {
    const { data: subcategories, error } = await supabase
      .from('subcategories')
      .select('id, name, slug')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    return subcategories || [];
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return [];
  }
};

/**
 * Fetches featured products from database
 */
export const fetchFeaturedProducts = async (limit: number = 4): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    
    // Get top-rated and in-stock products
    const featuredProducts = allProducts
      .filter(product => product.inStock)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);

    return featuredProducts;
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }
};

/**
 * Fetches new arrivals
 */
export const fetchNewArrivals = async (limit: number = 4): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    
    // Get newest products
    const newArrivals = allProducts
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return newArrivals;
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    return [];
  }
};

/**
 * Fetches popular products
 */
export const fetchPopularProducts = async (limit: number = 4): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    
    // Get products with highest review count and rating
    const popularProducts = allProducts
      .filter(product => product.reviewCount > 0 || product.rating > 0)
      .sort((a, b) => (b.reviewCount * b.rating) - (a.reviewCount * a.rating))
      .slice(0, limit);

    return popularProducts.length > 0 ? popularProducts : allProducts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
};

/**
 * Fetches products by category
 */
export const fetchProductsByCategory = async (categoryName: string): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    return allProducts.filter(product => product.category.toLowerCase() === categoryName.toLowerCase());
  } catch (error) {
    console.error('Error fetching products by category:', error);
    return [];
  }
};

/**
 * Fetches products by subcategory
 */
export const fetchProductsBySubcategory = async (category: string, subcategory: string): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    return allProducts.filter(
      product => 
        product.category.toLowerCase() === category.toLowerCase() && 
        product.subcategory?.toLowerCase().includes(subcategory.toLowerCase())
    );
  } catch (error) {
    console.error('Error fetching products by subcategory:', error);
    return [];
  }
};

/**
 * Fetches best selling products (high rating and review count)
 */
export const fetchBestSellers = async (limit: number = 20): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    return allProducts
      .filter(product => product.rating >= 4.0 && product.reviewCount >= 10)
      .sort((a, b) => (b.rating * b.reviewCount) - (a.rating * a.reviewCount))
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching best sellers:', error);
    return [];
  }
};

/**
 * Fetches products on sale (with compare at price)
 */
export const fetchDealsProducts = async (limit: number = 20): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    return allProducts
      .filter(product => product.compareAtPrice && product.compareAtPrice > product.price)
      .sort((a, b) => {
        const aDiscount = ((a.compareAtPrice! - a.price) / a.compareAtPrice!) * 100;
        const bDiscount = ((b.compareAtPrice! - b.price) / b.compareAtPrice!) * 100;
        return bDiscount - aDiscount; // Sort by highest discount percentage
      })
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching deals products:', error);
    return [];
  }
};

/**
 * Fetches a single product by slug
 */
export const fetchProductBySlug = async (slug: string): Promise<Product | null> => {
  try {
    console.log('Fetching product with slug:', slug);
    
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        product_images (
          image_url,
          position
        ),
        product_variations (
          id,
          product_id,
          sku,
          price,
          quantity,
          attributes,
          image_url
        ),
        stores (
          id,
          name,
          slug,
          vendors (
            id,
            business_name
          )
        )
      `)
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) {
      console.error('Error fetching product by slug:', error);
      return null;
    }

    if (!product) {
      console.warn('No product found with slug:', slug);
      return null;
    }

    console.log('Product found:', product.name);
    return mapDatabaseProduct(
      product,
      product.product_images || [],
      product.product_variations || []
    );
  } catch (error) {
    console.error('Exception fetching product by slug:', error);
    return null;
  }
};

/**
 * Fetches related products (same category, excluding current product)
 */
export const fetchRelatedProducts = async (productId: string, category: string, limit: number = 4): Promise<Product[]> => {
  try {
    const allProducts = await fetchAllProducts();
    return allProducts
      .filter(product => product.id !== productId && product.category === category)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching related products:', error);
    return [];
  }
};

/**
 * Resolves a custom domain to a store slug.
 * Returns the store slug if found and the domain is active, null otherwise.
 */
export const resolveCustomDomain = async (hostname: string): Promise<string | null> => {
  try {
    const { data: domainRecord, error } = await supabase
      .from('merchant_custom_domains')
      .select(`
        domain,
        status,
        store_id,
        vendor_id
      `)
      .eq('domain', hostname)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !domainRecord?.store_id) return null;

    // Verify vendor subscription is still Gold
    const { data: vendor } = await supabase
      .from('vendors')
      .select('subscription_tier')
      .eq('id', domainRecord.vendor_id)
      .maybeSingle();

    if (!vendor || vendor.subscription_tier !== 'gold') return null;

    // Get store slug
    const { data: store } = await supabase
      .from('stores')
      .select('slug')
      .eq('id', domainRecord.store_id)
      .maybeSingle();

    return store?.slug || null;
  } catch (error) {
    console.error('Error resolving custom domain:', error);
    return null;
  }
};

/**
 * Fetches store by custom domain - returns full store data
 */
export const fetchStoreByDomain = async (hostname: string) => {
  try {
    const storeSlug = await resolveCustomDomain(hostname);
    if (!storeSlug) return null;
    return await fetchStoreBySlug(storeSlug);
  } catch (error) {
    console.error('Error fetching store by domain:', error);
    return null;
  }
};