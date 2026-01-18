import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  store_id: string;
  product_name?: string;
}

interface NewOrderAlertRequest {
  orderId: string;
  orderTotal: number;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    name?: string;
    street?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
  };
  orderItems: OrderItem[];
  createdAt: string;
}

const generateVendorEmailHtml = (
  orderId: string,
  orderTotal: number,
  customerName: string,
  shippingAddress: NewOrderAlertRequest['shippingAddress'],
  vendorItems: OrderItem[],
  vendorTotal: number,
  createdAt: string
) => {
  const itemsHtml = vendorItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">R ${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  const addressLines = [
    shippingAddress.name,
    shippingAddress.street,
    `${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.postal_code}`,
    shippingAddress.country
  ].filter(Boolean).join('<br>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 New Order Received!</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">You have received a new order that requires your attention.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Order Information</h3>
          <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(createdAt).toLocaleString('en-ZA')}</p>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${customerName}</p>
          <p style="margin: 5px 0;"><strong>Your Total:</strong> R ${vendorTotal.toFixed(2)}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Items to Fulfill</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Product</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Address</h3>
          <p style="margin: 0; color: #4b5563;">${addressLines}</p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://hipomusjocacncjsvgfa.lovableproject.com/vendor/dashboard?tab=orders" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            View in Dashboard
          </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Please process this order as soon as possible.<br>
          <strong>1145 Lifestyle Platform</strong>
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated notification from 1145 Lifestyle.</p>
      </div>
    </body>
    </html>
  `;
};

const generateAdminEmailHtml = (
  orderId: string,
  orderTotal: number,
  customerName: string,
  customerEmail: string,
  shippingAddress: NewOrderAlertRequest['shippingAddress'],
  orderItems: OrderItem[],
  createdAt: string,
  vendorCount: number
) => {
  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">R ${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  const addressLines = [
    shippingAddress.name,
    shippingAddress.street,
    `${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.postal_code}`,
    shippingAddress.country
  ].filter(Boolean).join('<br>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📊 New Order Placed</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">A new order has been placed on the platform.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</h3>
          <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(createdAt).toLocaleString('en-ZA')}</p>
          <p style="margin: 5px 0;"><strong>Total Value:</strong> R ${orderTotal.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Items:</strong> ${orderItems.length}</p>
          <p style="margin: 5px 0;"><strong>Vendors Involved:</strong> ${vendorCount}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${customerName}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${customerEmail}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Address</h3>
          <p style="margin: 0; color: #4b5563;">${addressLines}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">All Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Product</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://hipomusjocacncjsvgfa.lovableproject.com/admin/dashboard?tab=orders" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            View in Admin Dashboard
          </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          <strong>1145 Lifestyle Platform</strong>
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>Admin notification from 1145 Lifestyle.</p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("New order alert function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orderId,
      orderTotal,
      customerName,
      customerEmail,
      shippingAddress,
      orderItems,
      createdAt
    }: NewOrderAlertRequest = await req.json();

    console.log(`Processing new order alert for order ${orderId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get product names for items
    const productIds = orderItems.map(item => item.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const productNameMap = new Map(products?.map(p => [p.id, p.name]) || []);
    const itemsWithNames = orderItems.map(item => ({
      ...item,
      product_name: productNameMap.get(item.product_id) || 'Unknown Product'
    }));

    // Group items by store/vendor
    const itemsByStore = new Map<string, OrderItem[]>();
    for (const item of itemsWithNames) {
      const storeItems = itemsByStore.get(item.store_id) || [];
      storeItems.push(item);
      itemsByStore.set(item.store_id, storeItems);
    }

    // Get store and vendor info
    const storeIds = Array.from(itemsByStore.keys());
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, vendor_id')
      .in('id', storeIds);

    const vendorIds = stores?.map(s => s.vendor_id) || [];
    const { data: vendors } = await supabase
      .from('vendors')
      .select('id, business_email, business_name')
      .in('id', vendorIds);

    const storeVendorMap = new Map(stores?.map(s => [s.id, s.vendor_id]) || []);
    const vendorEmailMap = new Map(vendors?.map(v => [v.id, { email: v.business_email, name: v.business_name }]) || []);

    // Send emails to each vendor
    const vendorEmailPromises = [];
    for (const [storeId, items] of itemsByStore) {
      const vendorId = storeVendorMap.get(storeId);
      const vendorInfo = vendorId ? vendorEmailMap.get(vendorId) : null;
      
      if (vendorInfo?.email) {
        const vendorTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vendorHtml = generateVendorEmailHtml(
          orderId,
          orderTotal,
          customerName,
          shippingAddress,
          items,
          vendorTotal,
          createdAt
        );

        vendorEmailPromises.push(
          resend.emails.send({
            from: "1145 Lifestyle <no-reply@mail.1145lifestyle.com>",
            to: [vendorInfo.email],
            subject: `🎉 New Order Received - Order #${orderId.slice(0, 8).toUpperCase()}`,
            html: vendorHtml,
          }).then(result => {
            console.log(`Email sent to vendor ${vendorInfo.name}:`, result);
            return result;
          }).catch(error => {
            console.error(`Failed to send email to vendor ${vendorInfo.name}:`, error);
            return null;
          })
        );
      }
    }

    // Get admin emails
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];

    // Send email to admins
    if (adminEmails.length > 0) {
      const adminHtml = generateAdminEmailHtml(
        orderId,
        orderTotal,
        customerName,
        customerEmail,
        shippingAddress,
        itemsWithNames,
        createdAt,
        itemsByStore.size
      );

      vendorEmailPromises.push(
        resend.emails.send({
          from: "1145 Lifestyle <no-reply@mail.1145lifestyle.com>",
          to: adminEmails,
          subject: `📊 New Order #${orderId.slice(0, 8).toUpperCase()} - R ${orderTotal.toFixed(2)}`,
          html: adminHtml,
        }).then(result => {
          console.log("Email sent to admins:", result);
          return result;
        }).catch(error => {
          console.error("Failed to send email to admins:", error);
          return null;
        })
      );
    }

    // Wait for all emails to send
    await Promise.all(vendorEmailPromises);

    console.log("All new order alert emails processed");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-new-order-alert function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
