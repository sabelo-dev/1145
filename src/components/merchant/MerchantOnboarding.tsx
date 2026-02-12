
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Steps } from "@/components/vendor/Steps";
import { CheckCircle, Upload } from "lucide-react";

const VendorOnboarding: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [vendorData, setVendorData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storeDetails, setStoreDetails] = useState({
    name: "",
    slug: "",
    description: "",
    categories: [] as string[],
  });

  // Get or create vendor record
  useEffect(() => {
    const initializeVendor = async () => {
      // If user is null/undefined, we're still loading auth
      if (user === null) {
        setIsLoading(false);
        return;
      }
      
      // If user is defined but no id, there's an auth issue
      if (!user?.id) {
        console.error('User authenticated but no ID available');
        setIsLoading(false);
        return;
      }

      try {
        // Check if vendor exists
        const { data: existingVendor } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingVendor) {
          setVendorData(existingVendor);
        } else {
          // Create new vendor record
          const { data: newVendor, error } = await supabase
            .from('vendors')
            .insert({
              user_id: user.id,
              business_name: user.name || 'New Merchant',
              status: 'pending'
            })
            .select()
            .single();

          if (error) throw error;
          setVendorData(newVendor);
        }
      } catch (error) {
        console.error('Error initializing vendor:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to initialize vendor profile.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeVendor();
  }, [user]);

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (!e.target.files || e.target.files.length === 0 || !vendorData) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorData.id}/${type}.${fileExt}`;
      
      // For now, we'll simulate upload by creating a blob URL
      const documentUrl = URL.createObjectURL(file);
      
      // Save document in vendor_documents table
      const { error: docError } = await supabase
        .from('vendor_documents')
        .upsert({
          vendor_id: vendorData.id,
          document_type: type,
          document_url: documentUrl,
        });
        
      if (docError) throw docError;
      
      setDocuments(prev => ({ ...prev, [type]: documentUrl }));
      
      toast({
        title: "Document Uploaded",
        description: `${type} was successfully uploaded.`,
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload the document. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createStore = async () => {
    if (!vendorData) return;

    try {
      // Generate slug from name if slug is empty
      let slug = storeDetails.slug.trim();
      if (!slug && storeDetails.name) {
        slug = storeDetails.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      // Check if slug already exists
      const { data: existingStore } = await supabase
        .from('stores')
        .select('slug')
        .eq('slug', slug)
        .maybeSingle();

      if (existingStore) {
        // Generate unique slug by appending random number
        slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }

      // Create store
      const { data, error } = await supabase
        .from('stores')
        .insert({
          vendor_id: vendorData.id,
          name: storeDetails.name,
          slug: slug,
          description: storeDetails.description,
        })
        .select();
        
      if (error) {
        // Check if it's still a duplicate slug error (race condition)
        if (error.code === '23505' && error.message.includes('stores_slug_key')) {
          toast({
            variant: "destructive",
            title: "Store URL Conflict",
            description: "This store URL is taken. Please try a different name.",
          });
          return;
        }
        throw error;
      }
      
      // Add store categories
      if (storeDetails.categories.length > 0) {
        const categoryEntries = storeDetails.categories.map(categoryId => ({
          store_id: data[0].id,
          category_id: categoryId,
        }));
        
        const { error: catError } = await supabase
          .from('store_categories')
          .insert(categoryEntries);
          
        if (catError) throw catError;
      }
      
      // Update vendor status to indicate onboarding completion
      const { error: vendorUpdateError } = await supabase
        .from('vendors')
        .update({ status: 'pending' })
        .eq('id', vendorData.id);

      if (vendorUpdateError) throw vendorUpdateError;
      
      toast({
        title: "Store Created",
        description: "Your store has been successfully created!",
      });
      
      setStep(3); // Move to final step
    } catch (error) {
      console.error("Error creating store:", error);
      toast({
        variant: "destructive",
        title: "Store Creation Failed",
        description: "Failed to create your store. Please try again.",
      });
    }
  };
  
  const steps = [
    { id: 1, name: "Upload Documents" },
    { id: 2, name: "Store Details" },
    { id: 3, name: "Complete" },
  ];

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Merchant Onboarding</h1>
      
      <Steps steps={steps} currentStep={step} />
      
      {step === 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Upload Required Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="businessLicense">Business License</Label>
              <div className="flex items-center mt-2">
                <Input
                  id="businessLicense"
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, "business-license")}
                  disabled={isUploading}
                  className="max-w-sm"
                />
                {documents["business-license"] && (
                  <CheckCircle className="ml-2 h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="idProof">ID Proof</Label>
              <div className="flex items-center mt-2">
                <Input
                  id="idProof"
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, "id-proof")}
                  disabled={isUploading}
                  className="max-w-sm"
                />
                {documents["id-proof"] && (
                  <CheckCircle className="ml-2 h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="bankDetails">Bank Details</Label>
              <div className="flex items-center mt-2">
                <Input
                  id="bankDetails"
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, "bank-details")}
                  disabled={isUploading}
                  className="max-w-sm"
                />
                {documents["bank-details"] && (
                  <CheckCircle className="ml-2 h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!documents["business-license"] || !documents["id-proof"] || !documents["bank-details"]}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {step === 2 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Create Your Store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                value={storeDetails.name}
                onChange={(e) => setStoreDetails(prev => ({ ...prev, name: e.target.value }))}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="storeSlug">Store URL</Label>
              <Input
                id="storeSlug"
                value={storeDetails.slug}
                onChange={(e) => setStoreDetails(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                className="mt-2"
                placeholder="your-store-url"
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be used in your store's URL: yourwebsite.com/store/{storeDetails.slug || 'your-store-url'}
              </p>
            </div>
            
            <div>
              <Label htmlFor="storeDescription">Store Description</Label>
              <Textarea
                id="storeDescription"
                value={storeDetails.description}
                onChange={(e) => setStoreDetails(prev => ({ ...prev, description: e.target.value }))}
                className="mt-2 min-h-[100px]"
              />
            </div>
            
            <div>
              <Label htmlFor="categories">Product Categories</Label>
              <Select
                onValueChange={(value) => {
                  if (!storeDetails.categories.includes(value)) {
                    setStoreDetails(prev => ({
                      ...prev,
                      categories: [...prev.categories, value]
                    }));
                  }
                }}
              >
                <SelectTrigger id="categories" className="mt-2">
                  <SelectValue placeholder="Select categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="home-kitchen">Home & Kitchen</SelectItem>
                  <SelectItem value="beauty">Beauty & Personal Care</SelectItem>
                  <SelectItem value="books">Books</SelectItem>
                  <SelectItem value="sports">Sports & Outdoors</SelectItem>
                </SelectContent>
              </Select>
              
              {storeDetails.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {storeDetails.categories.map((category) => (
                    <div key={category} className="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {category}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-4 w-4 p-0"
                        onClick={() => {
                          setStoreDetails(prev => ({
                            ...prev,
                            categories: prev.categories.filter(c => c !== category)
                          }));
                        }}
                      >
                        &times;
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                onClick={createStore} 
                disabled={!storeDetails.name || !storeDetails.slug}
              >
                Create Store
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {step === 3 && (
        <Card className="mt-6 text-center">
          <CardHeader>
            <CardTitle className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <h2 className="text-xl font-bold">Onboarding Complete!</h2>
            <p>
              Thank you for completing the merchant onboarding process. Your application is now under review.
              You will receive a notification once your account has been approved.
            </p>
            <Button onClick={() => window.location.href = "/"}>
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VendorOnboarding;
