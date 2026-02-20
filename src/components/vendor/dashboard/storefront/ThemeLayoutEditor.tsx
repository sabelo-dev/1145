import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Palette, Type, Globe, BarChart3, Upload, Video, X, Loader2 } from "lucide-react";
import { StorefrontLayout, StorefrontTier } from "@/types/storefront";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ThemeLayoutEditorProps {
  accentColor: string;
  onAccentColorChange: (val: string) => void;
  secondaryColor: string;
  onSecondaryColorChange: (val: string) => void;
  layoutType: StorefrontLayout;
  onLayoutTypeChange: (val: StorefrontLayout) => void;
  ctaText: string;
  onCtaTextChange: (val: string) => void;
  ctaUrl: string;
  onCtaUrlChange: (val: string) => void;
  videoBannerUrl: string;
  onVideoBannerUrlChange: (val: string) => void;
  customFont: string;
  onCustomFontChange: (val: string) => void;
  customDomain: string;
  onCustomDomainChange: (val: string) => void;
  gaTrackingId: string;
  onGaTrackingIdChange: (val: string) => void;
  metaPixelId: string;
  onMetaPixelIdChange: (val: string) => void;
  customMetaTitle: string;
  onCustomMetaTitleChange: (val: string) => void;
  customMetaDescription: string;
  onCustomMetaDescriptionChange: (val: string) => void;
  whiteLabel: boolean;
  onWhiteLabelChange: (val: boolean) => void;
  tier: StorefrontTier;
  isEditing: boolean;
}

const ThemeLayoutEditor: React.FC<ThemeLayoutEditorProps> = (props) => {
  const {
    accentColor, onAccentColorChange,
    secondaryColor, onSecondaryColorChange,
    layoutType, onLayoutTypeChange,
    ctaText, onCtaTextChange, ctaUrl, onCtaUrlChange,
    videoBannerUrl, onVideoBannerUrlChange,
    customFont, onCustomFontChange,
    customDomain, onCustomDomainChange,
    gaTrackingId, onGaTrackingIdChange,
    metaPixelId, onMetaPixelIdChange,
    customMetaTitle, onCustomMetaTitleChange,
    customMetaDescription, onCustomMetaDescriptionChange,
    whiteLabel, onWhiteLabelChange,
    tier, isEditing,
  } = props;

  const { user } = useAuth();
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const isBronzePlus = tier !== 'starter';
  const isSilverPlus = tier === 'silver' || tier === 'gold';
  const isGold = tier === 'gold';

  const handleVideoUpload = async (file: File) => {
    if (!user?.id) return;
    if (!file.type.startsWith('video/')) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload a video file (MP4, WebM, etc.)" });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum video size is 100MB" });
      return;
    }
    try {
      setUploadingVideo(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `videos/${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('vendor-videos').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('vendor-videos').getPublicUrl(fileName);
      onVideoBannerUrlChange(publicUrl);
      toast({ title: "Video uploaded", description: "Your video banner has been uploaded successfully" });
    } catch (error) {
      console.error('Video upload error:', error);
      toast({ variant: "destructive", title: "Upload failed", description: "Failed to upload video" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const isVideoFile = (url: string) => {
    return url && (url.match(/\.(mp4|webm|ogg)(\?|$)/i) || url.includes('vendor-videos'));
  };

  return (
    <div className="space-y-6">
      {isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Primary Accent</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => onAccentColorChange(e.target.value)} disabled={!isEditing} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={accentColor} onChange={(e) => onAccentColorChange(e.target.value)} disabled={!isEditing} className="w-28 text-sm" />
                </div>
              </div>
              {isSilverPlus && (
                <div className="space-y-1">
                  <Label className="text-xs">Secondary</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={(e) => onSecondaryColorChange(e.target.value)} disabled={!isEditing} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={secondaryColor} onChange={(e) => onSecondaryColorChange(e.target.value)} disabled={!isEditing} className="w-28 text-sm" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isSilverPlus && (
        <Card>
          <CardHeader><CardTitle className="text-base">Store Layout</CardTitle></CardHeader>
          <CardContent>
            <Select value={layoutType} onValueChange={(val) => onLayoutTypeChange(val as StorefrontLayout)} disabled={!isEditing}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid Layout</SelectItem>
                <SelectItem value="modern">Modern Layout</SelectItem>
                <SelectItem value="minimal">Minimal Layout</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {isSilverPlus && (
        <Card>
          <CardHeader><CardTitle className="text-base">Hero CTA Button</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Button Text</Label>
                <Input value={ctaText} onChange={(e) => onCtaTextChange(e.target.value)} disabled={!isEditing} placeholder="Shop Now" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Button Link</Label>
                <Input value={ctaUrl} onChange={(e) => onCtaUrlChange(e.target.value)} disabled={!isEditing} placeholder="/shop" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video Banner
            </CardTitle>
            <CardDescription>
              {isGold ? "Upload a video or paste a URL for your hero section" : "Add a video URL to your hero section"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoBannerUrl && (
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-h-48">
                {isVideoFile(videoBannerUrl) ? (
                  <video src={videoBannerUrl} className="w-full h-full object-cover" controls muted />
                ) : (
                  <iframe src={videoBannerUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="Preview" />
                )}
                {isEditing && (
                  <Button variant="destructive" size="sm" className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full" onClick={() => onVideoBannerUrlChange('')}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {isGold && isEditing && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} className="flex-1">
                  {uploadingVideo ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="h-4 w-4 mr-2" />Upload Video (max 100MB)</>)}
                </Button>
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ''; }} className="hidden" />
                <span className="text-xs text-muted-foreground self-center">or</span>
                <Input value={isVideoFile(videoBannerUrl) ? '' : videoBannerUrl} onChange={(e) => onVideoBannerUrlChange(e.target.value)} disabled={!isEditing} placeholder="https://youtube.com/embed/..." className="flex-1" />
              </div>
            )}

            {!isGold && (
              <Input value={videoBannerUrl} onChange={(e) => onVideoBannerUrlChange(e.target.value)} disabled={!isEditing} placeholder="https://youtube.com/embed/... or video URL" />
            )}
          </CardContent>
        </Card>
      )}

      {isGold && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" />Custom Typography</CardTitle></CardHeader>
            <CardContent>
              <Select value={customFont || 'default'} onValueChange={(val) => onCustomFontChange(val === 'default' ? '' : val)} disabled={!isEditing}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Platform Default</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Poppins">Poppins</SelectItem>
                  <SelectItem value="Lora">Lora</SelectItem>
                  <SelectItem value="DM Sans">DM Sans</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Custom Domain</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={customDomain} onChange={(e) => onCustomDomainChange(e.target.value)} disabled={!isEditing} placeholder="mystore.com" />
              <div className="flex items-center gap-2">
                <Switch checked={whiteLabel} onCheckedChange={onWhiteLabelChange} disabled={!isEditing} />
                <Label className="text-sm">White-label (remove platform branding)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Analytics & SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Custom Meta Title</Label><Input value={customMetaTitle} onChange={(e) => onCustomMetaTitleChange(e.target.value)} disabled={!isEditing} placeholder="My Store - Premium Products" /></div>
              <div className="space-y-1"><Label className="text-xs">Custom Meta Description</Label><Input value={customMetaDescription} onChange={(e) => onCustomMetaDescriptionChange(e.target.value)} disabled={!isEditing} placeholder="Discover premium products..." /></div>
              <div className="space-y-1"><Label className="text-xs">Google Analytics ID</Label><Input value={gaTrackingId} onChange={(e) => onGaTrackingIdChange(e.target.value)} disabled={!isEditing} placeholder="G-XXXXXXXXXX" /></div>
              <div className="space-y-1"><Label className="text-xs">Meta Pixel ID</Label><Input value={metaPixelId} onChange={(e) => onMetaPixelIdChange(e.target.value)} disabled={!isEditing} placeholder="123456789" /></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ThemeLayoutEditor;
