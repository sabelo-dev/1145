
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ShippingForm from "./ShippingForm";
import PaymentMethodSelector from "./PaymentMethodSelector";
import { supabase } from "@/integrations/supabase/client";
import { calculateShipping } from "@/utils/shippingCalculator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const checkoutSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  phone: z.string().min(1, "Phone number is required"),
  paymentMethod: z.enum(["cc", "ef", "mp", "mc", "sc", "ss"], {
    required_error: "Please select a payment method",
  }),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
}

interface CheckoutFormProps {
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  isProcessing,
  setIsProcessing,
}) => {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: user?.email || "",
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      postalCode: "",
      phone: "",
      paymentMethod: "cc",
    },
  });

  // Fetch user profile and saved addresses
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;

      const [profileResult, addressesResult] = await Promise.all([
        supabase.from("profiles").select("name, email, phone").eq("id", user.id).maybeSingle(),
        supabase.from("user_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
      ]);

      // Set email and name from profile
      if (profileResult.data) {
        const profile = profileResult.data;
        form.setValue("email", profile.email || user.email || "");
        if (profile.phone) form.setValue("phone", profile.phone);

        // Split name into first/last
        if (profile.name) {
          const parts = profile.name.trim().split(/\s+/);
          if (parts.length >= 2) {
            form.setValue("firstName", parts.slice(0, -1).join(" "));
            form.setValue("lastName", parts[parts.length - 1]);
          } else {
            form.setValue("firstName", parts[0]);
          }
        }
      }

      // Load saved addresses
      if (addressesResult.data && addressesResult.data.length > 0) {
        setSavedAddresses(addressesResult.data);
        // Auto-select default address
        const defaultAddr = addressesResult.data.find((a) => a.is_default) || addressesResult.data[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          applyAddress(defaultAddr);
        }
      }
    };

    loadUserData();
  }, [user?.id]);

  const applyAddress = (addr: SavedAddress) => {
    form.setValue("address", addr.street);
    form.setValue("city", addr.city);
    form.setValue("postalCode", addr.postal_code);
    if (addr.phone) form.setValue("phone", addr.phone);
    // Split address name into first/last if it has parts
    if (addr.name) {
      const parts = addr.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        form.setValue("firstName", parts.slice(0, -1).join(" "));
        form.setValue("lastName", parts[parts.length - 1]);
      }
    }
  };

  const handleAddressChange = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === "new") return; // User wants to type manually
    const addr = savedAddresses.find((a) => a.id === addressId);
    if (addr) applyAddress(addr);
  };

  // Calculate shipping cost when cart changes
  useEffect(() => {
    const fetchShippingCost = async () => {
      if (cart?.subtotal !== undefined) {
        setLoadingShipping(true);
        const cartItems = cart.items.map(item => ({
          productId: item.productId,
          productType: item.productType
        }));
        const cost = await calculateShipping(cart.subtotal, cartItems);
        setShippingCost(cost);
        setLoadingShipping(false);
      }
    };
    
    fetchShippingCost();
  }, [cart?.subtotal, cart?.items]);

  const onSubmit = async (values: CheckoutFormValues) => {
    if (!cart?.items?.length) {
      toast({
        variant: "destructive",
        title: "Cart is empty",
        description: "Please add items to your cart before checking out.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Calculate order totals
      const subtotal = cart.subtotal || 0;
      const shipping = shippingCost;
      const tax = subtotal * 0.15; // 15% VAT
      const total = subtotal + shipping + tax;

      if (["cc", "ef", "mp", "mc", "sc", "ss"].includes(values.paymentMethod)) {
        const { data: paymentData, error } = await supabase.functions.invoke('payfast-payment', {
          body: {
            amount: total,
            itemName: `Order for ${cart.items.length} items`,
            returnUrl: `${window.location.origin}/checkout/success`,
            cancelUrl: `${window.location.origin}/checkout/cancel`,
            notifyUrl: `${window.location.origin}/api/payfast/notify`,
            customerEmail: values.email,
            customerFirstName: values.firstName,
            customerLastName: values.lastName,
            paymentMethod: values.paymentMethod,
          },
        });

        if (error) {
          console.error("PayFast edge function error:", error);
          throw new Error(error.message || "Failed to create payment");
        }

        if (!paymentData) {
          throw new Error("No response from payment gateway");
        }

        if (paymentData?.success && paymentData?.formData) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = paymentData.action;
          form.style.display = 'none';

          Object.entries(paymentData.formData).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value!.toString();
            form.appendChild(input);
          });

          document.body.appendChild(form);
          form.submit();
        } else {
          throw new Error("No payment data received");
        }
      } else {
        toast({
          title: "Payment method not implemented",
          description: "This payment method is not yet available.",
        });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "An error occurred during checkout",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {savedAddresses.length > 0 && (
          <div className="space-y-2">
            <Label>Shipping Address</Label>
            <Select value={selectedAddressId} onValueChange={handleAddressChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved address" />
              </SelectTrigger>
              <SelectContent>
                {savedAddresses.map((addr) => (
                  <SelectItem key={addr.id} value={addr.id}>
                    {addr.label} — {addr.street}, {addr.city} {addr.postal_code}
                  </SelectItem>
                ))}
                <SelectItem value="new">Enter a new address</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <h2 className="text-lg font-medium text-foreground mb-4">Contact & Shipping Information</h2>
          <ShippingForm control={form.control} />
        </div>

        <div>
          <h2 className="text-lg font-medium text-foreground mb-4">Payment Method</h2>
          <PaymentMethodSelector control={form.control} />
        </div>

        <Button
          type="submit"
          className="w-full bg-wwe-navy hover:bg-wwe-navy/90"
          disabled={isProcessing || loadingShipping}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : loadingShipping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating shipping...
            </>
          ) : (
            `Complete Order - R${(() => {
              const subtotal = cart?.subtotal || 0;
              const shipping = shippingCost;
              const tax = subtotal * 0.15;
              const total = subtotal + shipping + tax;
              return total.toFixed(2);
            })()}`
          )}
        </Button>
      </form>
    </Form>
  );
};

export default CheckoutForm;
