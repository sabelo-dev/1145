import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Star, Upload, Video, Mail, Megaphone, FileText, ShoppingBag, Share2, MessageSquare, HelpCircle, Users } from "lucide-react";
import { FAQItem, Testimonial } from "@/types/storefront";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContentSectionsEditorProps {
  aboutUs: string;
  onAboutUsChange: (val: string) => void;
  socialLinks: Record<string, string>;
  onSocialLinksChange: (val: Record<string, string>) => void;
  testimonials: Testimonial[];
  onTestimonialsChange: (val: Testimonial[]) => void;
  faqItems: FAQItem[];
  onFaqItemsChange: (val: FAQItem[]) => void;
  announcementText: string;
  onAnnouncementTextChange: (val: string) => void;
  announcementActive: boolean;
  onAnnouncementActiveChange: (val: boolean) => void;
  // Video
  videoBannerUrl: string;
  onVideoBannerUrlChange: (val: string) => void;
  // CTA
  ctaText: string;
  onCtaTextChange: (val: string) => void;
  ctaUrl: string;
  onCtaUrlChange: (val: string) => void;
  // Email capture
  emailCaptureEnabled: boolean;
  onEmailCaptureEnabledChange: (val: boolean) => void;
  emailCaptureTitle: string;
  onEmailCaptureTitleChange: (val: string) => void;
  // Active sections from layout builder
  activeSections: string[];
  tier: string;
  isEditing: boolean;
  userId?: string;
}

const socialPlatforms = ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'linkedin'];

const SECTION_META: Record<string, { icon: React.ReactNode; label: string }> = {
  hero: { icon: <Video className="h-4 w-4" />, label: 'Hero Banner' },
  announcement: { icon: <Megaphone className="h-4 w-4" />, label: 'Announcement Bar' },
  featured: { icon: <Star className="h-4 w-4" />, label: 'Featured Products' },
  products: { icon: <ShoppingBag className="h-4 w-4" />, label: 'All Products' },
  categories: { icon: <FileText className="h-4 w-4" />, label: 'Categories' },
  about: { icon: <Users className="h-4 w-4" />, label: 'About Us' },
  testimonials: { icon: <MessageSquare className="h-4 w-4" />, label: 'Testimonials' },
  faq: { icon: <HelpCircle className="h-4 w-4" />, label: 'FAQ' },
  newsletter: { icon: <Mail className="h-4 w-4" />, label: 'Newsletter Signup' },
  social: { icon: <Share2 className="h-4 w-4" />, label: 'Social Links' },
  video: { icon: <Video className="h-4 w-4" />, label: 'Video Section' },
  cta: { icon: <Megaphone className="h-4 w-4" />, label: 'Call to Action' },
  policies: { icon: <FileText className="h-4 w-4" />, label: 'Store Policies' },
};

const ContentSectionsEditor: React.FC<ContentSectionsEditorProps> = ({
  aboutUs, onAboutUsChange,
  socialLinks, onSocialLinksChange,
  testimonials, onTestimonialsChange,
  faqItems, onFaqItemsChange,
  announcementText, onAnnouncementTextChange,
  announcementActive, onAnnouncementActiveChange,
  videoBannerUrl, onVideoBannerUrlChange,
  ctaText, onCtaTextChange,
  ctaUrl, onCtaUrlChange,
  emailCaptureEnabled, onEmailCaptureEnabledChange,
  emailCaptureTitle, onEmailCaptureTitleChange,
  activeSections,
  tier, isEditing, userId,
}) => {
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const isBronzePlus = tier !== 'starter';
  const isGold = tier === 'gold';

  const hasSection = (id: string) => activeSections.includes(id);

  const handleVideoUpload = async (file: File) => {
    if (!userId) return;
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!validTypes.includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid format", description: "Please upload MP4, WebM, or OGG" });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 100MB" });
      return;
    }
    try {
      setUploadingVideo(true);
      const ext = file.name.split('.').pop();
      const path = `videos/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('vendor-videos').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('vendor-videos').getPublicUrl(path);
      onVideoBannerUrlChange(publicUrl);
      toast({ title: "Video uploaded", description: "Your hero video is ready" });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload video" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const addTestimonial = () => {
    onTestimonialsChange([
      ...testimonials,
      { id: crypto.randomUUID(), name: '', text: '', rating: 5 },
    ]);
  };

  const updateTestimonial = (id: string, field: keyof Testimonial, value: any) => {
    onTestimonialsChange(
      testimonials.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  const removeTestimonial = (id: string) => {
    onTestimonialsChange(testimonials.filter(t => t.id !== id));
  };

  const addFAQ = () => {
    onFaqItemsChange([
      ...faqItems,
      { id: crypto.randomUUID(), question: '', answer: '' },
    ]);
  };

  const updateFAQ = (id: string, field: keyof FAQItem, value: string) => {
    onFaqItemsChange(
      faqItems.map(f => f.id === id ? { ...f, [field]: value } : f)
    );
  };

  const removeFAQ = (id: string) => {
    onFaqItemsChange(faqItems.filter(f => f.id !== id));
  };

  // If no sections active, show message
  if (activeSections.length === 0 && isGold) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No sections added yet. Go to the <strong>Advanced</strong> tab to add homepage sections, then come back here to edit their content.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gold tier hint */}
      {isGold && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Showing editors for sections enabled in your <strong>Homepage Layout Builder</strong> (Advanced tab). Add or remove sections there.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hero / Video Section */}
      {(hasSection('hero') || hasSection('video')) && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              Hero Video Banner
              {isGold && <Badge variant="outline" className="text-xs">Gold</Badge>}
            </CardTitle>
            <CardDescription>Add a video to your hero section — upload a file or paste a URL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video preview */}
            {videoBannerUrl && (
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-48">
                {videoBannerUrl.includes('.mp4') || videoBannerUrl.includes('.webm') || videoBannerUrl.includes('.ogg') || videoBannerUrl.includes('vendor-videos') ? (
                  <video src={videoBannerUrl} className="w-full h-full object-cover" muted loop playsInline controls />
                ) : (
                  <iframe src={videoBannerUrl} className="w-full h-full" allowFullScreen />
                )}
              </div>
            )}

            {/* Upload button (Gold) */}
            {isGold && isEditing && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingVideo ? "Uploading..." : "Upload Video (MP4, WebM, OGG — max 100MB)"}
                </Button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }}
                  className="hidden"
                />
              </div>
            )}

            {/* URL input */}
            <div className="space-y-1">
              <Label className="text-xs">Or paste video URL</Label>
              <Input
                value={videoBannerUrl}
                onChange={(e) => onVideoBannerUrlChange(e.target.value)}
                disabled={!isEditing}
                placeholder="https://youtube.com/embed/... or direct video URL"
              />
            </div>

            {isEditing && videoBannerUrl && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onVideoBannerUrlChange('')}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Video
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Announcement Bar */}
      {hasSection('announcement') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Announcement Bar
              <Badge variant={announcementActive ? "default" : "secondary"} className="text-xs">
                {announcementActive ? 'Active' : 'Inactive'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={announcementText}
              onChange={(e) => onAnnouncementTextChange(e.target.value)}
              disabled={!isEditing}
              placeholder="🎉 Free shipping on orders over R500!"
            />
            {isEditing && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={announcementActive}
                  onCheckedChange={onAnnouncementActiveChange}
                />
                <Label className="text-sm">{announcementActive ? 'Active' : 'Inactive'}</Label>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* About Us */}
      {hasSection('about') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              About Us
            </CardTitle>
            <CardDescription>Tell customers about your brand story</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={aboutUs}
              onChange={(e) => onAboutUsChange(e.target.value)}
              disabled={!isEditing}
              rows={4}
              placeholder="Share your brand story, mission, and what makes you unique..."
            />
          </CardContent>
        </Card>
      )}

      {/* Social Links */}
      {hasSection('social') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Social Media Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {socialPlatforms.map(platform => (
                <div key={platform} className="space-y-1">
                  <Label className="capitalize text-xs">{platform}</Label>
                  <Input
                    value={socialLinks[platform] || ''}
                    onChange={(e) => onSocialLinksChange({ ...socialLinks, [platform]: e.target.value })}
                    disabled={!isEditing}
                    placeholder={`https://${platform}.com/...`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      {hasSection('cta') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Call to Action
            </CardTitle>
            <CardDescription>Promotional CTA block displayed on your homepage</CardDescription>
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

      {/* Testimonials */}
      {hasSection('testimonials') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Testimonials
            </CardTitle>
            <CardDescription>Customer reviews displayed on your storefront</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testimonials.map((t, idx) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Testimonial {idx + 1}</span>
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => removeTestimonial(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <Input
                  value={t.name}
                  onChange={(e) => updateTestimonial(t.id, 'name', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Customer name"
                  className="text-sm"
                />
                <Textarea
                  value={t.text}
                  onChange={(e) => updateTestimonial(t.id, 'text', e.target.value)}
                  disabled={!isEditing}
                  placeholder="What did they say?"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`h-4 w-4 cursor-pointer ${star <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                      onClick={() => isEditing && updateTestimonial(t.id, 'rating', star)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {isEditing && (
              <Button variant="outline" size="sm" onClick={addTestimonial} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Testimonial
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      {hasSection('faq') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              FAQ Section
            </CardTitle>
            <CardDescription>Frequently asked questions for your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqItems.map((f, idx) => (
              <div key={f.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Question {idx + 1}</span>
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => removeFAQ(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <Input
                  value={f.question}
                  onChange={(e) => updateFAQ(f.id, 'question', e.target.value)}
                  disabled={!isEditing}
                  placeholder="What question do customers often ask?"
                  className="text-sm"
                />
                <Textarea
                  value={f.answer}
                  onChange={(e) => updateFAQ(f.id, 'answer', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Your answer..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
            {isEditing && (
              <Button variant="outline" size="sm" onClick={addFAQ} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add FAQ
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Newsletter / Email Capture */}
      {hasSection('newsletter') && isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Newsletter Signup
            </CardTitle>
            <CardDescription>Capture customer emails on your storefront</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={emailCaptureEnabled}
                onCheckedChange={onEmailCaptureEnabledChange}
                disabled={!isEditing}
              />
              <Label className="text-sm">{emailCaptureEnabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Signup Heading</Label>
              <Input
                value={emailCaptureTitle}
                onChange={(e) => onEmailCaptureTitleChange(e.target.value)}
                disabled={!isEditing}
                placeholder="Subscribe to our newsletter"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-editable info sections */}
      {hasSection('featured') && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <Star className="h-5 w-5 mx-auto mb-1" />
            <strong>Featured Products</strong> — managed from your Products tab
          </CardContent>
        </Card>
      )}
      {hasSection('products') && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <ShoppingBag className="h-5 w-5 mx-auto mb-1" />
            <strong>All Products</strong> — automatically displays your product catalog
          </CardContent>
        </Card>
      )}
      {hasSection('categories') && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <FileText className="h-5 w-5 mx-auto mb-1" />
            <strong>Categories</strong> — managed from your Products tab
          </CardContent>
        </Card>
      )}
      {hasSection('policies') && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <FileText className="h-5 w-5 mx-auto mb-1" />
            <strong>Store Policies</strong> — edit on the Basics tab
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContentSectionsEditor;
