
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
    value: "ef",
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
    value: "ss",
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
              value={field.value}
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
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={method.value} id={method.value} className="shrink-0" />
                        <FormLabel
                          htmlFor={method.value}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                        >
                          <Icon className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${method.iconColor}`} />
                          <div className="min-w-0">
                            <div className="font-medium leading-snug">{method.label}</div>
                            <div className="text-xs font-normal leading-snug text-muted-foreground sm:text-sm">
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
