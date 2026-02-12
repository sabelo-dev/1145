import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Camera, 
  MapPin, 
  Clock, 
  Star, 
  Edit3, 
  Save, 
  X,
  Store,
  Globe,
  Phone,
  Mail,
  Upload
} from "lucide-react";

const VendorShopfront = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo_url: "",
    banner_url: "",
    shipping_policy: "",
    return_policy: "",
  });

  useEffect(() => {
    console.log('VendorShopfront: User authentication status:', { 
      userId: user?.id, 
      email: user?.email,
      isAuthenticated: !!user 
    });
    fetchStoreData();
  }, [user?.id]);

  const fetchStoreData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // First get vendor data
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;
      setVendorData(vendor);

      // Then get store data
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('vendor_id', vendor.id)
        .maybeSingle();

      if (storeError && storeError.code !== 'PGRST116') throw storeError;

      if (store) {
        setStoreData(store);
        setFormData({
          name: store.name || "",
          description: store.description || "",
          logo_url: store.logo_url || "",
          banner_url: store.banner_url || "",
          shipping_policy: store.shipping_policy || "",
          return_policy: store.return_policy || "",
        });
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load store data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorData?.id) {
      console.error('No vendor data found');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Vendor information not found. Please refresh the page.",
      });
      return;
    }

    if (!formData.name?.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Shop name is required",
      });
      return;
    }

    try {
      setSaving(true);
      console.log('Saving store data:', formData);

      if (storeData) {
        // Update existing store
        const { error } = await supabase
          .from('stores')
          .update({
            name: formData.name,
            description: formData.description,
            logo_url: formData.logo_url,
            banner_url: formData.banner_url,
            shipping_policy: formData.shipping_policy,
            return_policy: formData.return_policy,
          })
          .eq('id', storeData.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('Store updated successfully');
      } else {
        // Create new store
        // Generate slug from name
        let slug = formData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

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

        const { data: newStore, error } = await supabase
          .from('stores')
          .insert({
            vendor_id: vendorData.id,
            name: formData.name,
            slug: slug,
            description: formData.description,
            logo_url: formData.logo_url,
            banner_url: formData.banner_url,
            shipping_policy: formData.shipping_policy,
            return_policy: formData.return_policy,
          })
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          // Check if it's still a duplicate slug error (race condition)
          if (error.code === '23505' && error.message.includes('stores_slug_key')) {
            toast({
              variant: "destructive",
              title: "Store URL Conflict",
              description: "This store name is already taken. Please try a different name.",
            });
            return;
          }
          throw error;
        }
        console.log('Store created successfully:', newStore);
        setStoreData(newStore);
      }

      setIsEditing(false);
      toast({
        title: "Success",
        description: "Store information saved successfully",
      });
    } catch (error) {
      console.error('Error saving store data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save store data",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    console.log('uploadFile called with:', { file: file.name, bucket, folder, userId: user?.id });
    
    if (!user?.id) {
      console.error('No user ID found for upload');
      throw new Error('User not authenticated');
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${user.id}/${Date.now()}.${fileExt}`;
    console.log('Generated fileName:', fileName);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    console.log('Upload result:', { data, error });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    console.log('Generated publicUrl:', publicUrl);
    return publicUrl;
  };

  const processBannerFile = async (file: File) => {
    console.log('Banner upload initiated:', { fileName: file.name, fileSize: file.size, fileType: file.type });

    // Check authentication first
    if (!user?.id) {
      console.error('User not authenticated for banner upload');
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to upload images",
      });
      return;
    }

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
      });
      return;
    }

    try {
      setUploading(true);
      console.log('Uploading banner file:', file.name);
      const url = await uploadFile(file, 'vendor-banners', 'banners');
      console.log('Banner uploaded successfully:', url);
      setFormData(prev => ({ ...prev, banner_url: url }));
      toast({
        title: "Success",
        description: "Banner uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to upload banner: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processBannerFile(file);
  };

  const handleBannerDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    
    await processBannerFile(file);
  };

  const handleBannerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleBannerDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Logo upload initiated:', { fileName: file.name, fileSize: file.size, fileType: file.type });

    // Check authentication first
    if (!user?.id) {
      console.error('User not authenticated for logo upload');
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to upload images",
      });
      return;
    }

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit for logos
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    try {
      setUploading(true);
      console.log('Uploading logo file:', file.name);
      const url = await uploadFile(file, 'vendor-logos', 'logos');
      console.log('Logo uploaded successfully:', url);
      setFormData(prev => ({ ...prev, logo_url: url }));
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to upload logo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (storeData) {
      setFormData({
        name: storeData.name || "",
        description: storeData.description || "",
        logo_url: storeData.logo_url || "",
        banner_url: storeData.banner_url || "",
        shipping_policy: storeData.shipping_policy || "",
        return_policy: storeData.return_policy || "",
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return <div>Loading store data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Shop Frontend</h2>
          <p className="text-muted-foreground">Manage your store's public appearance</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Shop
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Shop Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Shop Banner & Logo
          </CardTitle>
          <CardDescription>
            Your shop's visual identity shown to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Banner Image */}
          <div className="space-y-2">
            <Label>Banner Image (1200x400px recommended)</Label>
            <div 
              className={`relative h-48 w-full bg-muted rounded-lg overflow-hidden border-2 border-dashed transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-border'
              }`}
              onDrop={isEditing ? handleBannerDrop : undefined}
              onDragOver={isEditing ? handleBannerDragOver : undefined}
              onDragLeave={isEditing ? handleBannerDragLeave : undefined}
            >
              {formData.banner_url ? (
                <img 
                  src={formData.banner_url} 
                  alt="Shop banner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <Camera className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No banner image</p>
                  </div>
                </div>
              )}
              {isEditing && (
                <div className={`absolute inset-0 ${isDragging ? 'bg-primary/20' : 'bg-black/50'} flex items-center justify-center transition-colors`}>
                  <div className="text-center">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploading}
                      className="mb-2"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Uploading..." : "Change Banner"}
                    </Button>
                    <p className="text-xs text-white">or drag and drop an image here</p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Shop Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.logo_url || ""} alt="Shop logo" />
                  <AvatarFallback>
                    <Store className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Square format recommended (200x200px minimum)
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Core details about your shop
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                value={formData.name}
                disabled={!isEditing}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Shop Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              disabled={!isEditing}
              rows={4}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your shop and what makes it special..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Shop Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Shop Policies</CardTitle>
          <CardDescription>
            Terms and policies shown to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shippingPolicy">Shipping Policy</Label>
            <Textarea
              id="shippingPolicy"
              value={formData.shipping_policy}
              disabled={!isEditing}
              rows={2}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                shipping_policy: e.target.value
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnsPolicy">Returns Policy</Label>
            <Textarea
              id="returnsPolicy"
              value={formData.return_policy}
              disabled={!isEditing}
              rows={2}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                return_policy: e.target.value
              }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorShopfront;