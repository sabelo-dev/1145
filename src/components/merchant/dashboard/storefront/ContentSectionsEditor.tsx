import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, GripVertical, Star } from "lucide-react";
import { FAQItem, Testimonial } from "@/types/storefront";

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
  tier: string;
  isEditing: boolean;
}

const socialPlatforms = ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'linkedin'];

const ContentSectionsEditor: React.FC<ContentSectionsEditorProps> = ({
  aboutUs,
  onAboutUsChange,
  socialLinks,
  onSocialLinksChange,
  testimonials,
  onTestimonialsChange,
  faqItems,
  onFaqItemsChange,
  announcementText,
  onAnnouncementTextChange,
  announcementActive,
  onAnnouncementActiveChange,
  tier,
  isEditing,
}) => {
  const isBronzePlus = tier !== 'starter';
  const isSilverPlus = tier === 'silver' || tier === 'gold';

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

  return (
    <div className="space-y-6">
      {/* About Us - Bronze+ */}
      {isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Us</CardTitle>
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

      {/* Social Links - Bronze+ */}
      {isBronzePlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social Media Links</CardTitle>
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

      {/* Announcement Bar - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAnnouncementActiveChange(!announcementActive)}
              >
                {announcementActive ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Testimonials - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Testimonials</CardTitle>
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

      {/* FAQ - Silver+ */}
      {isSilverPlus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FAQ Section</CardTitle>
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
    </div>
  );
};

export default ContentSectionsEditor;
