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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, Loader2, CheckCircle, Upload } from "lucide-react";

const schema = z.object({
  title: z.string().trim().min(3, "Min 3 characters").max(200),
  category: z.string().min(1, "Select a category"),
  description: z.string().trim().min(20, "Min 20 characters").max(2000),
  price: z.string().refine(val => parseFloat(val) > 0, "Price must be greater than 0"),
  quantity: z.string().refine(val => parseInt(val) >= 1, "Minimum quantity is 1"),
  sku: z.string().trim().max(50).optional().or(z.literal("")),
});

export type FirstProductValues = z.infer<typeof schema>;

const CATEGORIES = [
  "Electronics", "Clothing & Fashion", "Home & Kitchen", "Beauty & Personal Care",
  "Books & Media", "Sports & Outdoors", "Toys & Games", "Food & Beverages",
  "Health & Wellness", "Automotive", "Jewelry & Accessories", "Other",
];

interface StepFirstProductProps {
  productImage: string | null;
  onImageUpload: (file: File) => Promise<void>;
  onNext: (data: FirstProductValues) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const StepFirstProduct: React.FC<StepFirstProductProps> = ({
  productImage, onImageUpload, onNext, onBack, isLoading,
}) => {
  const form = useForm<FirstProductValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", category: "", description: "", price: "", quantity: "1", sku: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          First Product Listing
        </CardTitle>
        <CardDescription>Add your first product to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Product Title *</FormLabel>
                <FormControl><Input placeholder="Product name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c.toLowerCase().replace(/ & /g, "-")}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe your product..." className="resize-none min-h-[100px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (ZAR) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Quantity *</FormLabel>
                  <FormControl><Input type="number" min="1" placeholder="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="sku" render={({ field }) => (
              <FormItem>
                <FormLabel>SKU (optional)</FormLabel>
                <FormControl><Input placeholder="SKU-001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Product Image */}
            <div className="space-y-2">
              <Label>Product Image *</Label>
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onImageUpload(e.target.files[0])} className="max-w-sm" />
                {productImage && <CheckCircle className="h-5 w-5 text-primary" />}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={onBack}>Back</Button>
              <Button type="submit" disabled={!productImage || isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Product & Continue"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default StepFirstProduct;
