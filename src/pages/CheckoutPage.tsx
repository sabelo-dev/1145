
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import OrderSummary from "@/components/checkout/OrderSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Lock, Truck } from "lucide-react";

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!user) {
    navigate("/login");
    return null;
  }

  if (!cart?.items?.length) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Add some items to your cart before checking out.
            </p>
            <Button onClick={() => navigate("/shop")} className="rounded-xl px-6">
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { label: "Cart", done: true },
    { label: "Details", done: false, active: true },
    { label: "Payment", done: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-foreground">Checkout</h1>
            </div>

            {/* Progress steps */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.done ? "bg-primary text-primary-foreground" :
                      step.active ? "bg-primary/10 text-primary border-2 border-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {step.done ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${step.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${step.done ? "bg-primary" : "bg-border"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-5 lg:gap-x-10">
          {/* Form - 3 cols */}
          <div className="lg:col-span-3">
            <CheckoutForm
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </div>

          {/* Summary - 2 cols */}
          <div className="mt-10 lg:mt-0 lg:col-span-2">
            <div className="lg:sticky lg:top-24 space-y-4">
              <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-5">
                  <OrderSummary />
                </CardContent>
              </Card>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Lock, label: "Secure Checkout" },
                  { icon: ShieldCheck, label: "Buyer Protection" },
                  { icon: Truck, label: "Fast Shipping" },
                ].map((badge) => (
                  <div key={badge.label} className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50 border border-border/30">
                    <badge.icon className="h-4 w-4 text-primary mb-1" />
                    <span className="text-[10px] font-medium text-muted-foreground">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
