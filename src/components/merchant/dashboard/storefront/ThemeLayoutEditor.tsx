import React, { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Palette, Type, Globe, BarChart3 } from "lucide-react";
import { StorefrontLayout, StorefrontTier } from "@/types/storefront";

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

  const isBronzePlus = tier !== 'starter';
  const isSilverPlus = tier === 'silver' || tier === 'gold';
  const isGold = tier === 'gold';

  return (
    <div className="space-y-6">
      {/* Accent Color - Bronze+ */}
      {isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Primary Accent</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => onAccentColorChange(e.target.value)}
                    disabled={!isEditing}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => onAccentColorChange(e.target.value)}
                    disabled={!isEditing}
                    className="w-28 text-sm"
                  />
                </div>
              </div>
              {isSilverPlus && (
                <div className="space-y-1">
                  <Label className="text-xs">Secondary</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => onSecondaryColorChange(e.target.value)}
                      disabled={!isEditing}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => onSecondaryColorChange(e.target.value)}
                      disabled={!isEditing}
                      className="w-28 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layout Type - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={layoutType}
              onValueChange={(val) => onLayoutTypeChange(val as StorefrontLayout)}
              disabled={!isEditing}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid Layout</SelectItem>
                <SelectItem value="modern">Modern Layout</SelectItem>
                <SelectItem value="minimal">Minimal Layout</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* CTA Button - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hero CTA Button</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Button Text</Label>
                <Input
                  value={ctaText}
                  onChange={(e) => onCtaTextChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Shop Now"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Button Link</Label>
                <Input
                  value={ctaUrl}
                  onChange={(e) => onCtaUrlChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="/shop"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Banner - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Video Banner</CardTitle>
            <CardDescription>Add a video to your hero section</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={videoBannerUrl}
              onChange={(e) => onVideoBannerUrlChange(e.target.value)}
              disabled={!isEditing}
              placeholder="https://youtube.com/embed/... or video URL"
            />
          </CardContent>
        </Card>
      )}

      {/* Gold-only features */}
      {isGold && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4" />
                Custom Typography
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={customFont || 'default'}
                onValueChange={(val) => onCustomFontChange(val === 'default' ? '' : val)}
                disabled={!isEditing}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Custom Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={customDomain}
                onChange={(e) => onCustomDomainChange(e.target.value)}
                disabled={!isEditing}
                placeholder="mystore.com"
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={whiteLabel}
                  onCheckedChange={onWhiteLabelChange}
                  disabled={!isEditing}
                />
                <Label className="text-sm">White-label (remove platform branding)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics & SEO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Custom Meta Title</Label>
                <Input
                  value={customMetaTitle}
                  onChange={(e) => onCustomMetaTitleChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="My Store - Premium Products"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Custom Meta Description</Label>
                <Input
                  value={customMetaDescription}
                  onChange={(e) => onCustomMetaDescriptionChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Discover premium products..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Google Analytics ID</Label>
                <Input
                  value={gaTrackingId}
                  onChange={(e) => onGaTrackingIdChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta Pixel ID</Label>
                <Input
                  value={metaPixelId}
                  onChange={(e) => onMetaPixelIdChange(e.target.value)}
                  disabled={!isEditing}
                  placeholder="123456789"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ThemeLayoutEditor;
