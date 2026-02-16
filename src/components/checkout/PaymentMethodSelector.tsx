
import React from "react";
import { Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Smartphone, QrCode, Wallet, Building } from "lucide-react";

interface PaymentMethodSelectorProps {
  control: Control<any>;
}

const paymentMethods = [
  {
    value: "cc",
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, American Express, Diners Club",
    icon: CreditCard,
    iconColor: "text-blue-600",
  },
  {
    value: "eft",
    label: "Instant EFT",
    description: "Pay directly from your bank account",
    icon: Building,
    iconColor: "text-green-600",
  },
  {
    value: "mp",
    label: "Masterpass",
    description: "Pay with Masterpass by Mastercard",
    icon: Wallet,
    iconColor: "text-orange-500",
  },
  {
    value: "mc",
    label: "Mobicred",
    description: "Buy now, pay later with Mobicred",
    icon: Smartphone,
    iconColor: "text-purple-600",
  },
  {
    value: "sc",
    label: "SnapScan",
    description: "Scan & pay with the SnapScan app",
    icon: QrCode,
    iconColor: "text-blue-500",
  },
];

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ control }) => {
  return (
    <FormField
      control={control}
      name="paymentMethod"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              className="space-y-3"
            >
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <Card
                    key={method.value}
                    className={`border-2 transition-colors cursor-pointer ${
                      field.value === method.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/20"
                    }`}
                    onClick={() => field.onChange(method.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value={method.value} id={method.value} />
                        <FormLabel
                          htmlFor={method.value}
                          className="flex items-center space-x-3 cursor-pointer flex-1"
                        >
                          <Icon className={`h-6 w-6 ${method.iconColor}`} />
                          <div>
                            <div className="font-medium">{method.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {method.description}
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default PaymentMethodSelector;
