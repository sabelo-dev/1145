import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";

const schema = z.object({
  legalBusinessName: z.string().trim().min(2, "Required").max(100),
  businessType: z.string().min(1, "Select a business type"),
  taxId: z.string().trim().max(50).optional().or(z.literal("")),
  businessAddress: z.string().trim().min(10, "Provide a complete address").max(500),
  businessPhone: z.string().trim().min(10, "Min 10 characters").max(20)
    .regex(/^[0-9+\-() ]+$/, "Invalid phone number"),
});

export type BusinessInfoValues = z.infer<typeof schema>;

interface StepBusinessInfoProps {
  defaultValues?: Partial<BusinessInfoValues>;
  onNext: (data: BusinessInfoValues) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const StepBusinessInfo: React.FC<StepBusinessInfoProps> = ({ defaultValues, onNext, onBack, isLoading }) => {
  const form = useForm<BusinessInfoValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalBusinessName: "",
      businessType: "",
      taxId: "",
      businessAddress: "",
      businessPhone: "",
      ...defaultValues,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business Information
        </CardTitle>
        <CardDescription>Tell us about your business</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
            <FormField control={form.control} name="legalBusinessName" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Business Name *</FormLabel>
                <FormControl><Input placeholder="ABC Trading Company Ltd" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="businessType" render={({ field }) => (
              <FormItem>
                <FormLabel>Business Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select business type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="individual">Individual / Sole Proprietor</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="nonprofit">Non-Profit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="taxId" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID / Registration Number</FormLabel>
                <FormControl><Input placeholder="Enter tax ID" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="businessAddress" render={({ field }) => (
              <FormItem>
                <FormLabel>Business Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Full address including city, state, postal code, country" className="resize-none min-h-[80px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="businessPhone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl><Input placeholder="+1 (555) 123-4567" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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

export default StepBusinessInfo;
