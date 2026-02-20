import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, Edit3, Save, X, Store, Upload, Crown, Medal, Award, Star,
  Eye, ArrowUpRight, Lock
} from "lucide-react";
import { StorefrontTier, TIER_CAPABILITIES, StorefrontLayout, Testimonial, FAQItem } from "@/types/storefront";
import LockedFeatureCard from "./storefront/LockedFeatureCard";
import ContentSectionsEditor from "./storefront/ContentSectionsEditor";
import ThemeLayoutEditor from "./storefront/ThemeLayoutEditor";
import SectionBuilder from "./storefront/SectionBuilder";

const tierIcons: Record<StorefrontTier, React.ReactNode> = {
  starter: <Star className="h-4 w-4" />,
  bronze: <Medal className="h-4 w-4" />,
  silver: <Award className="h-4 w-4" />,
  gold: <Crown className="h-4 w-4" />,
};

const tierLabels: Record<StorefrontTier, string> = {
  starter: 'Free Plan',
  bronze: 'Bronze Plan',
  silver: 'Silver Plan',
  gold: 'Gold Plan',
};

const VendorShopfront = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [customization, setCustomization] = useState<any>(null);
  const [tier, setTier] = useState<StorefrontTier>('starter');
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

  const [customData, setCustomData] = useState({
    accent_color: "#6366f1",
    secondary_color: "#8b5cf6",
    layout_type: "grid" as StorefrontLayout,
    about_us: "",
    social_links: {} as Record<string, string>,
    cta_button_text: "Shop Now",
    cta_button_url: "",
    video_banner_url: "",
    testimonials: [] as Testimonial[],
    faq_items: [] as FAQItem[],
    announcement_bar_text: "",
    announcement_bar_active: false,
    email_capture_enabled: false,
    email_capture_title: "Subscribe to our newsletter",
    custom_font: "",
    custom_domain: "",
    ga_tracking_id: "",
    meta_pixel_id: "",
    custom_meta_title: "",
    custom_meta_description: "",
    white_label: false,
    homepage_sections: ["hero", "featured", "products", "testimonials", "faq"] as string[],
  });

  const capabilities = TIER_CAPABILITIES[tier] || TIER_CAPABILITIES['starter'];

  useEffect(() => {
    fetchStoreData();
  }, [user?.id]);

  const fetchStoreData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (vendorError) throw vendorError;
      setVendorData(vendor);
      setTier((vendor.subscription_tier as StorefrontTier) || 'starter');

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

        // Fetch customization
        const { data: cust } = await supabase
          .from('storefront_customizations')
          .select('*')
          .eq('store_id', store.id)
          .maybeSingle();

        if (cust) {
          setCustomization(cust);
          setCustomData({
            accent_color: cust.accent_color || "#6366f1",
            secondary_color: cust.secondary_color || "#8b5cf6",
            layout_type: (cust.layout_type as StorefrontLayout) || "grid",
            about_us: cust.about_us || "",
            social_links: (cust.social_links as Record<string, string>) || {},
            cta_button_text: cust.cta_button_text || "Shop Now",
            cta_button_url: cust.cta_button_url || "",
            video_banner_url: cust.video_banner_url || "",
            testimonials: (cust.testimonials as unknown as Testimonial[]) || [],
            faq_items: (cust.faq_items as unknown as FAQItem[]) || [],
            announcement_bar_text: cust.announcement_bar_text || "",
            announcement_bar_active: cust.announcement_bar_active || false,
            email_capture_enabled: cust.email_capture_enabled || false,
            email_capture_title: cust.email_capture_title || "Subscribe to our newsletter",
            custom_font: cust.custom_font || "",
            custom_domain: cust.custom_domain || "",
            ga_tracking_id: cust.ga_tracking_id || "",
            meta_pixel_id: cust.meta_pixel_id || "",
            custom_meta_title: cust.custom_meta_title || "",
            custom_meta_description: cust.custom_meta_description || "",
            white_label: cust.white_label || false,
            homepage_sections: (cust.homepage_sections as string[]) || ["hero", "featured", "products", "testimonials", "faq"],
          });
        }
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load store data" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorData?.id || !formData.name?.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Shop name is required" });
      return;
    }

    try {
      setSaving(true);
      let currentStoreId = storeData?.id;

      if (storeData) {
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
        if (error) throw error;
      } else {
        let slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: existing } = await supabase.from('stores').select('slug').eq('slug', slug).maybeSingle();
        if (existing) slug = `${slug}-${Math.floor(Math.random() * 10000)}`;

        const { data: newStore, error } = await supabase
          .from('stores')
          .insert({
            vendor_id: vendorData.id,
            name: formData.name,
            slug,
            description: formData.description,
            logo_url: formData.logo_url,
            banner_url: formData.banner_url,
            shipping_policy: formData.shipping_policy,
            return_policy: formData.return_policy,
          })
          .select()
          .single();
        if (error) throw error;
        setStoreData(newStore);
        currentStoreId = newStore.id;
      }

      // Save customization (only for Bronze+)
      if (tier !== 'starter' && currentStoreId) {
        const custPayload = {
          store_id: currentStoreId,
          accent_color: customData.accent_color,
          secondary_color: customData.secondary_color,
          layout_type: customData.layout_type,
          about_us: customData.about_us || null,
          social_links: customData.social_links,
          cta_button_text: customData.cta_button_text,
          cta_button_url: customData.cta_button_url || null,
          video_banner_url: customData.video_banner_url || null,
          testimonials: customData.testimonials as unknown as any,
          faq_items: customData.faq_items as unknown as any,
          announcement_bar_text: customData.announcement_bar_text || null,
          announcement_bar_active: customData.announcement_bar_active,
          email_capture_enabled: customData.email_capture_enabled,
          custom_font: customData.custom_font || null,
          custom_domain: customData.custom_domain || null,
          ga_tracking_id: customData.ga_tracking_id || null,
          meta_pixel_id: customData.meta_pixel_id || null,
          custom_meta_title: customData.custom_meta_title || null,
          custom_meta_description: customData.custom_meta_description || null,
          white_label: customData.white_label,
          homepage_sections: customData.homepage_sections,
        };

        if (customization) {
          const { error } = await supabase
            .from('storefront_customizations')
            .update(custPayload)
            .eq('id', customization.id);
          if (error) throw error;
        } else {
          const { data: newCust, error } = await supabase
            .from('storefront_customizations')
            .insert(custPayload)
            .select()
            .single();
          if (error) throw error;
          setCustomization(newCust);
        }
      }

      setIsEditing(false);
      toast({ title: "Success", description: "Store saved successfully" });
    } catch (error) {
      console.error('Error saving store:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save store" });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    if (!user?.id) throw new Error('Not authenticated');
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrl;
  };

  const handleFileUpload = async (file: File, type: 'banner' | 'logo') => {
    if (!user?.id || !file.type.startsWith('image/')) return;
    const maxSize = type === 'banner' ? 10 : 5;
    if (file.size > maxSize * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: `Max ${maxSize}MB` });
      return;
    }
    try {
      setUploading(true);
      const bucket = type === 'banner' ? 'vendor-banners' : 'vendor-logos';
      const url = await uploadFile(file, bucket, type === 'banner' ? 'banners' : 'logos');
      setFormData(prev => ({ ...prev, [type === 'banner' ? 'banner_url' : 'logo_url']: url }));
      toast({ title: "Success", description: `${type === 'banner' ? 'Banner' : 'Logo'} uploaded` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    fetchStoreData();
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Storefront Manager</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="gap-1">
              {tierIcons[tier]}
              {tierLabels[tier]}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {tier === 'starter' ? 'Basic listing page' :
               tier === 'bronze' ? 'Branded starter store' :
               tier === 'silver' ? 'Professional branded experience' :
               'Premium branded store'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {storeData && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/store/${storeData.slug}`} target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </a>
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Store
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upsell for Free tier */}
      {tier === 'starter' && (
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Medal className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Upgrade to Bronze to customize your store</p>
                <p className="text-sm text-muted-foreground">Add a banner, logo, About Us section, and build customer trust</p>
              </div>
              <Button size="sm">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Upgrade
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="design" disabled={tier === 'starter'}>
            Design {tier === 'starter' && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="content" disabled={tier === 'starter'}>
            Content {tier === 'starter' && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="advanced" disabled={tier !== 'gold'}>
            Advanced {tier !== 'gold' && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
        </TabsList>

        {/* BASICS TAB */}
        <TabsContent value="basics" className="space-y-6">
          {/* Banner & Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Banner & Logo
              </CardTitle>
              <CardDescription>
                {capabilities.customBanner
                  ? "Customize your store's visual identity"
                  : "Free plan uses platform default appearance"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Banner */}
              <LockedFeatureCard
                title="Custom Banner"
                description="Upload a hero banner image"
                requiredTier="bronze"
                currentTier={tier}
              >
                <div className="space-y-2">
                  <Label>Banner Image (1200x400px)</Label>
                  <div
                    className={`relative h-48 w-full bg-muted rounded-lg overflow-hidden border-2 border-dashed transition-colors ${
                      isDragging ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onDrop={isEditing ? (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f, 'banner'); } : undefined}
                    onDragOver={isEditing ? (e) => { e.preventDefault(); setIsDragging(true); } : undefined}
                    onDragLeave={isEditing ? () => setIsDragging(false) : undefined}
                  >
                    {formData.banner_url ? (
                      <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No banner</p>
                        </div>
                      </div>
                    )}
                    {isEditing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Button variant="secondary" size="sm" onClick={() => bannerInputRef.current?.click()} disabled={uploading}>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Uploading..." : "Change Banner"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'banner'); }} className="hidden" />
                </div>
              </LockedFeatureCard>

              {/* Logo */}
              <div className="space-y-2">
                <Label>Store {capabilities.customLogo ? 'Logo' : 'Profile Image'}</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={formData.logo_url || ""} alt="Logo" />
                      <AvatarFallback><Store className="h-8 w-8" /></AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <Button
                        size="sm" variant="secondary"
                        className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tier === 'starter' ? 'Small circular profile image' : 'Brand logo (200x200px min)'}
                  </p>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'logo'); }} className="hidden" />
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <Input value={formData.name} disabled={!isEditing} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} disabled={!isEditing} rows={3} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Describe your store..." />
              </div>
            </CardContent>
          </Card>

          {/* Policies */}
          <Card>
            <CardHeader><CardTitle>Store Policies</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shipping Policy</Label>
                <Textarea value={formData.shipping_policy} disabled={!isEditing} rows={2} onChange={(e) => setFormData(p => ({ ...p, shipping_policy: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Return Policy</Label>
                <Textarea value={formData.return_policy} disabled={!isEditing} rows={2} onChange={(e) => setFormData(p => ({ ...p, return_policy: e.target.value }))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DESIGN TAB */}
        <TabsContent value="design" className="space-y-6">
          <ThemeLayoutEditor
            accentColor={customData.accent_color}
            onAccentColorChange={(v) => setCustomData(p => ({ ...p, accent_color: v }))}
            secondaryColor={customData.secondary_color}
            onSecondaryColorChange={(v) => setCustomData(p => ({ ...p, secondary_color: v }))}
            layoutType={customData.layout_type}
            onLayoutTypeChange={(v) => setCustomData(p => ({ ...p, layout_type: v }))}
            customFont={customData.custom_font}
            onCustomFontChange={(v) => setCustomData(p => ({ ...p, custom_font: v }))}
            customDomain={customData.custom_domain}
            onCustomDomainChange={(v) => setCustomData(p => ({ ...p, custom_domain: v }))}
            gaTrackingId={customData.ga_tracking_id}
            onGaTrackingIdChange={(v) => setCustomData(p => ({ ...p, ga_tracking_id: v }))}
            metaPixelId={customData.meta_pixel_id}
            onMetaPixelIdChange={(v) => setCustomData(p => ({ ...p, meta_pixel_id: v }))}
            customMetaTitle={customData.custom_meta_title}
            onCustomMetaTitleChange={(v) => setCustomData(p => ({ ...p, custom_meta_title: v }))}
            customMetaDescription={customData.custom_meta_description}
            onCustomMetaDescriptionChange={(v) => setCustomData(p => ({ ...p, custom_meta_description: v }))}
            whiteLabel={customData.white_label}
            onWhiteLabelChange={(v) => setCustomData(p => ({ ...p, white_label: v }))}
            tier={tier}
            isEditing={isEditing}
            storeSlug={storeData?.slug}
          />
        </TabsContent>

        {/* CONTENT TAB */}
        <TabsContent value="content" className="space-y-6">
          <ContentSectionsEditor
            aboutUs={customData.about_us}
            onAboutUsChange={(v) => setCustomData(p => ({ ...p, about_us: v }))}
            socialLinks={customData.social_links}
            onSocialLinksChange={(v) => setCustomData(p => ({ ...p, social_links: v }))}
            testimonials={customData.testimonials}
            onTestimonialsChange={(v) => setCustomData(p => ({ ...p, testimonials: v }))}
            faqItems={customData.faq_items}
            onFaqItemsChange={(v) => setCustomData(p => ({ ...p, faq_items: v }))}
            announcementText={customData.announcement_bar_text}
            onAnnouncementTextChange={(v) => setCustomData(p => ({ ...p, announcement_bar_text: v }))}
            announcementActive={customData.announcement_bar_active}
            onAnnouncementActiveChange={(v) => setCustomData(p => ({ ...p, announcement_bar_active: v }))}
            videoBannerUrl={customData.video_banner_url}
            onVideoBannerUrlChange={(v) => setCustomData(p => ({ ...p, video_banner_url: v }))}
            ctaText={customData.cta_button_text}
            onCtaTextChange={(v) => setCustomData(p => ({ ...p, cta_button_text: v }))}
            ctaUrl={customData.cta_button_url}
            onCtaUrlChange={(v) => setCustomData(p => ({ ...p, cta_button_url: v }))}
            emailCaptureEnabled={customData.email_capture_enabled}
            onEmailCaptureEnabledChange={(v) => setCustomData(p => ({ ...p, email_capture_enabled: v }))}
            emailCaptureTitle={customData.email_capture_title || "Subscribe to our newsletter"}
            onEmailCaptureTitleChange={(v) => setCustomData(p => ({ ...p, email_capture_title: v }))}
            activeSections={tier === 'gold' ? customData.homepage_sections : ['hero', 'about', 'social', 'testimonials', 'faq', 'announcement', 'cta', 'newsletter', 'featured', 'products', 'categories', 'policies']}
            tier={tier}
            isEditing={isEditing}
            userId={user?.id}
          />
        </TabsContent>

        {/* ADVANCED TAB (Gold only) */}
        <TabsContent value="advanced" className="space-y-6">
          <SectionBuilder
            sections={customData.homepage_sections}
            onSectionsChange={(v) => setCustomData(p => ({ ...p, homepage_sections: v }))}
            isEditing={isEditing}
          />
        </TabsContent>
      </Tabs>

      {/* Locked analytics preview for Free tier */}
      {tier === 'starter' && (
        <Card className="relative overflow-hidden opacity-60 border-dashed">
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="text-center p-6">
              <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-lg text-foreground mb-1">Store Analytics</p>
              <p className="text-sm text-muted-foreground mb-3">
                See views, conversion rates, and product performance
              </p>
              <Badge variant="outline" className="gap-1">
                <Medal className="h-4 w-4" />
                Upgrade to Bronze to unlock
              </Badge>
            </div>
          </div>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[200px]">
            <div className="grid grid-cols-3 gap-4">
              {['Views', 'Sales', 'Conversion'].map(label => (
                <div key={label} className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">---</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VendorShopfront;
