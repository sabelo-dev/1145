
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const vendorSchema = z.object({
  businessName: z.string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters"),
  businessEmail: z.string()
    .trim()
    .email("Please enter a valid business email")
    .max(255, "Email must be less than 255 characters"),
  businessPhone: z.string()
    .trim()
    .min(10, "Phone number must be at least 10 characters")
    .max(20, "Phone number must be less than 20 characters")
    .regex(/^[0-9+\-() ]+$/, "Please enter a valid phone number"),
  description: z.string()
    .trim()
    .min(50, "Description must be at least 50 characters to help customers understand your business")
    .max(1000, "Description must be less than 1000 characters"),
  businessAddress: z.string()
    .trim()
    .min(10, "Please provide a complete business address")
    .max(500, "Address must be less than 500 characters"),
  taxId: z.string()
    .trim()
    .max(50, "Tax ID must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  website: z.string()
    .trim()
    .url("Please enter a valid URL")
    .max(255, "Website URL must be less than 255 characters")
    .optional()
    .or(z.literal("")),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const RegisterVendorForm: React.FC = () => {
  const { user, register: registerUser, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      businessName: "",
      businessEmail: "",
      businessPhone: "",
      description: "",
      businessAddress: "",
      taxId: "",
      website: "",
      agreeTerms: false,
    },
  });

  const onSubmit = async (values: VendorFormValues) => {
    console.log('RegisterVendorForm onSubmit called with:', values);
    console.log('User context:', user);
    
    // If user is not logged in, redirect to main registration with vendor role
    if (!user) {
      console.log('No user found, redirecting to /register');
      navigate('/register', { state: { role: 'vendor', businessName: values.businessName, description: values.description } });
      return;
    }

    console.log('User is logged in, proceeding with vendor creation');
    setIsLoading(true);
    
    try {
      // Get fresh user data to ensure we have the latest session
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error('Authentication required. Please log in again.');
      }

      console.log('Current authenticated user ID:', currentUser.id);

      // Check if vendor already exists
      const { data: existingVendor, error: checkError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing vendor:', checkError);
        throw checkError;
      }

      if (existingVendor) {
        console.log('Vendor already exists, redirecting to dashboard');
        toast({
          title: "Already Registered",
          description: "You're already registered as a vendor.",
        });
        navigate('/merchant/dashboard');
        return;
      }

      console.log('Creating vendor record...');
      // Create vendor profile in Supabase with trial subscription
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 90); // 90 days trial

      const vendorData = {
        user_id: currentUser.id,
        business_name: values.businessName,
        description: values.description,
        status: "pending",
        subscription_tier: "trial",
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        subscription_status: "trial",
        business_email: values.businessEmail,
        business_phone: values.businessPhone,
        business_address: values.businessAddress,
        tax_id: values.taxId || null,
        website: values.website || null
      };

      console.log('Inserting vendor data:', vendorData);

      const { data: vendorResult, error: vendorError } = await supabase
        .from("vendors")
        .insert(vendorData)
        .select()
        .single();

      if (vendorError) {
        console.error('Vendor insert error:', vendorError);
        throw vendorError;
      }

      console.log('Vendor created successfully:', vendorResult);

      // Update user role to vendor in profiles table AFTER successful vendor creation
      console.log('Updating user profile role...');
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', currentUser.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        // Don't throw here as vendor was created successfully
        console.warn('Failed to update profile role, but vendor record created');
      }

      // Update user_roles table: remove consumer role and add vendor role
      console.log('Updating user_roles table...');
      
      // Delete consumer role
      const { error: deleteRoleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('role', 'consumer');

      if (deleteRoleError) {
        console.error('Error deleting consumer role:', deleteRoleError);
      }

      // Insert vendor role
      const { error: insertRoleError } = await supabase
        .from('user_roles')
        .insert({ user_id: currentUser.id, role: 'vendor' })
        .select()
        .single();

      if (insertRoleError) {
        console.error('Error inserting vendor role:', insertRoleError);
      }

      // Refresh user profile to update the auth context and wait for completion
      console.log('Refreshing user profile...');
      await refreshUserProfile();
      
      // Add a small delay to ensure context is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));

      toast({
        title: "Registration Successful",
        description: "Welcome! You have a 90-day free trial to explore all features.",
      });

      // Redirect to vendor dashboard after profile refresh
      console.log('Navigating to vendor dashboard...');
      navigate('/merchant/dashboard', { replace: true });
    } catch (error: any) {
      console.error("Error during vendor registration:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || 'Failed to register as a vendor. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-2">Become a Merchant</h1>
      <p className="text-muted-foreground mb-6">
        Please provide complete information about your business. All fields are required for verification.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Business Information */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Business Information</h3>
            
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Business Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC Trading Company Ltd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your business, products, and what makes you unique. Minimum 50 characters." 
                      className="resize-none min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{field.value.length} / 1000 characters</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Contact Information */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Contact Information</h3>
            
            <FormField
              control={form.control}
              name="businessEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@yourbusiness.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="businessPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Phone *</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="businessAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Address *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="123 Main Street, Suite 100, City, State/Province, Postal Code, Country" 
                      className="resize-none min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.yourbusiness.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Tax Information */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Tax Information</h3>
            
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID / VAT Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your tax identification number" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Recommended for tax compliance and payment processing
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Terms Agreement */}
          <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 border">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    I confirm that all information provided is accurate and agree to the Terms and Conditions and Merchant Guidelines *
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          
          <Button type="submit" disabled={isLoading} className="w-full" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Application...
              </>
            ) : (
              "Submit Merchant Application"
            )}
          </Button>
        </form>
      </Form>
      
      <div className="mt-6 p-4 bg-muted rounded-lg text-sm">
        <p className="font-semibold mb-2">What happens next?</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Your application will be reviewed within 1-2 business days</li>
          <li>You'll receive an email notification once approved</li>
          <li>After approval, you can start setting up your store and adding products</li>
          <li>You get a 90-day free trial to explore all merchant features</li>
        </ul>
      </div>
    </div>
  );
};

export default RegisterVendorForm;
