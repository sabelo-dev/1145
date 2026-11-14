
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { plausibleEvent } from "@/lib/plausible";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Package, Mail } from "lucide-react";

/**
 * The order this return belongs to: the buyer's newest order, if placed in the
 * last few hours, with how many paid orders they had before it. The return URL
 * carries no order id (the order is created by the payment function).
 */
async function latestOrder(userId: string): Promise<{ id: string; total: number; earlierPaid: number } | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, payment_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data?.length) return null;
  const [latest, ...earlier] = data;
  if (Date.now() - new Date(latest.created_at).getTime() > 6 * 60 * 60 * 1000) return null;
  return {
    id: latest.id,
    total: Number(latest.total) || 0,
    earlierPaid: earlier.filter((o) => o.payment_status === "paid").length,
  };
}

function alreadyTracked(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return true;
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: may count twice on refresh, never zero times.
  }
  return false;
}

const CheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Clear cart on successful payment
    clearCart();
  }, [clearCart]);

  // Purchases are recorded by the server (payfast-itn / payfast-payment), which
  // also counts buyers who never come back to this page. This marks the return,
  // and tells Plausible whether it was the buyer's first order or a repeat one.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const order = user ? await latestOrder(user.id) : null;
      if (cancelled) return;
      const kind = !user ? "Order" : order?.earlierPaid === 0 ? "First Order" : order ? "Repeat Order" : null;
      track("checkout_return", {
        payment: searchParams.get("pf_payment_id") ?? undefined,
        order_type: kind ?? undefined,
      });
      // Once per order (a refresh of this page must not count it again).
      const onceKey = `1145:order-tracked:${order?.id ?? searchParams.get("pf_payment_id") ?? ""}`;
      if (!kind || alreadyTracked(onceKey)) return;
      plausibleEvent(kind, {
        props: { order_number: order ? order.earlierPaid + 1 : undefined, buyer: user ? "account" : "guest" },
        revenue: order ? { amount: order.total, currency: "ZAR" } : undefined,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, user, authLoading]);

  const paymentId = searchParams.get("pf_payment_id");
  const paymentStatus = searchParams.get("payment_status");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="text-center">
          <CardContent className="p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Order Successful!
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Thank you for your purchase. Your order has been confirmed and is being processed.
            </p>

            {paymentId && (
              <div className="bg-gray-100 rounded-lg p-4 mb-8">
                <p className="text-sm text-gray-600">
                  Payment ID: <span className="font-mono font-medium">{paymentId}</span>
                </p>
                {paymentStatus && (
                  <p className="text-sm text-gray-600 mt-1">
                    Status: <span className="font-medium capitalize">{paymentStatus}</span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-center space-x-3">
                <Mail className="h-8 w-8 text-wwe-navy" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Order Confirmation</h3>
                  <p className="text-sm text-gray-600">
                    A confirmation email has been sent to you
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Package className="h-8 w-8 text-wwe-navy" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">Shipping Info</h3>
                  <p className="text-sm text-gray-600">
                    You'll receive tracking details soon
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/")}
                className="bg-wwe-navy hover:bg-wwe-navy/90"
              >
                Continue Shopping
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/account")}
              >
                View Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
