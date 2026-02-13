import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Loader2 } from "lucide-react";

const schema = z.object({
  vatRegistered: z.boolean(),
  vatNumber: z.string().trim().max(50).optional().or(z.literal("")),
  feeAgreement: z.boolean().refine(val => val, "You must accept the fee agreement"),
  payoutSchedule: z.string().min(1),
});

export type PaymentTaxValues = z.infer<typeof schema>;

interface StepPaymentTaxProps {
  commissionRate: number;
  defaultValues?: Partial<PaymentTaxValues>;
  onNext: (data: PaymentTaxValues) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const StepPaymentTax: React.FC<StepPaymentTaxProps> = ({ commissionRate, defaultValues, onNext, onBack, isLoading }) => {
  const form = useForm<PaymentTaxValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vatRegistered: false,
      vatNumber: "",
      feeAgreement: false,
      payoutSchedule: "weekly",
      ...defaultValues,
    },
  });

  const vatRegistered = form.watch("vatRegistered");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment & Tax Configuration
        </CardTitle>
        <CardDescription>Review fees and configure tax settings</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
            {/* Commission Structure */}
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <h4 className="font-medium">Commission Structure</h4>
              <p className="text-sm text-muted-foreground">
                Platform commission: <span className="font-semibold text-foreground">{commissionRate}%</span> per sale
              </p>
              <p className="text-xs text-muted-foreground">
                This rate applies to all successful transactions. Payment processing fees are separate.
              </p>
            </div>

            <FormField control={form.control} name="feeAgreement" render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0 rounded-md p-4 border">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>I understand and accept the commission structure and marketplace fees *</FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )} />

            <FormField control={form.control} name="payoutSchedule" render={({ field }) => (
              <FormItem>
                <FormLabel>Payout Schedule</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="vatRegistered" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>I am VAT registered</FormLabel>
              </FormItem>
            )} />

            {vatRegistered && (
              <FormField control={form.control} name="vatNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>VAT Number</FormLabel>
                  <FormControl><Input placeholder="Enter VAT number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={onBack}>Back</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Continue"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default StepPaymentTax;
