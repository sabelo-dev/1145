
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { CheckCircle, Package, Mail } from "lucide-react";

const CheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  useEffect(() => {
    // Clear cart on successful payment
    clearCart();
  }, [clearCart]);

  // Once per page load; a refresh may count twice, which the funnel tolerates.
  useEffect(() => {
    track("purchase", { payment: searchParams.get("pf_payment_id") ?? undefined });
  }, [searchParams]);

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
