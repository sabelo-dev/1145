import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Store, Loader2, Upload, CheckCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  storeName: z.string().trim().min(2, "Required").max(100),
  storeDescription: z.string().trim().min(20, "Min 20 characters").max(1000),
  returnPolicy: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type StoreSetupValues = z.infer<typeof schema>;

const SHIPPING_REGIONS = [
  "South Africa", "Nigeria", "Kenya", "Ghana", "Tanzania",
  "United States", "United Kingdom", "Europe", "Asia Pacific",
];

const SHIPPING_METHODS = [
  "Standard Delivery", "Express Delivery", "Same-Day Delivery",
  "Click & Collect", "International Shipping",
];

interface StepStoreSetupProps {
  defaultValues?: Partial<StoreSetupValues>;
  selectedRegions: string[];
  selectedMethods: string[];
  logoFile: string | null;
  bannerFile: string | null;
  onRegionsChange: (regions: string[]) => void;
  onMethodsChange: (methods: string[]) => void;
  onLogoUpload: (file: File) => Promise<void>;
  onBannerUpload: (file: File) => Promise<void>;
  onNext: (data: StoreSetupValues) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const StepStoreSetup: React.FC<StepStoreSetupProps> = ({
  defaultValues, selectedRegions, selectedMethods, logoFile, bannerFile,
  onRegionsChange, onMethodsChange, onLogoUpload, onBannerUpload, onNext, onBack, isLoading,
}) => {
  const form = useForm<StoreSetupValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: "",
      storeDescription: "",
      returnPolicy: "",
      ...defaultValues,
    },
  });

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Store Setup
        </CardTitle>
        <CardDescription>Configure your storefront</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
            <FormField control={form.control} name="storeName" render={({ field }) => (
              <FormItem>
                <FormLabel>Store Display Name *</FormLabel>
                <FormControl><Input placeholder="My Awesome Store" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="storeDescription" render={({ field }) => (
              <FormItem>
                <FormLabel>Store Description *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe your store and what you sell..." className="resize-none min-h-[100px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Logo */}
            <div className="space-y-2">
              <Label>Store Logo</Label>
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onLogoUpload(e.target.files[0])} className="max-w-sm" />
                {logoFile && <CheckCircle className="h-5 w-5 text-primary" />}
              </div>
            </div>

            {/* Banner */}
            <div className="space-y-2">
              <Label>Store Banner (optional)</Label>
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onBannerUpload(e.target.files[0])} className="max-w-sm" />
                {bannerFile && <CheckCircle className="h-5 w-5 text-primary" />}
              </div>
            </div>

            {/* Shipping Regions */}
            <div className="space-y-2">
              <Label>Shipping Regions</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SHIPPING_REGIONS.map((region) => (
                  <label key={region} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedRegions.includes(region)}
                      onCheckedChange={() => toggleItem(selectedRegions, region, onRegionsChange)}
                    />
                    {region}
                  </label>
                ))}
              </div>
            </div>

            {/* Shipping Methods */}
            <div className="space-y-2">
              <Label>Shipping Methods</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHIPPING_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedMethods.includes(method)}
                      onCheckedChange={() => toggleItem(selectedMethods, method, onMethodsChange)}
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>

            <FormField control={form.control} name="returnPolicy" render={({ field }) => (
              <FormItem>
                <FormLabel>Return Policy</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe your return and refund policy..." className="resize-none min-h-[80px]" {...field} />
                </FormControl>
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

export default StepStoreSetup;
