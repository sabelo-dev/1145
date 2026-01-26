import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInfluencer } from '@/hooks/useInfluencer';
import { SOCIAL_PLATFORMS, CONTENT_TYPES, ContentType } from '@/types/influencer';
import { supabase } from '@/integrations/supabase/client';
import { Instagram, Facebook, Twitter, Youtube, Music } from 'lucide-react';

interface SocialPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPost?: any;
  onSuccess: () => void;
}

export const SocialPostModal: React.FC<SocialPostModalProps> = ({
  open,
  onOpenChange,
  editingPost,
  onSuccess,
}) => {
  const { createPost, updatePost } = useInfluencer();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<ContentType>('plain');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setContentType(editingPost.content_type);
      setSelectedPlatforms(editingPost.platforms || []);
      setProductId(editingPost.product_id || '');
      setScheduledAt(editingPost.scheduled_at || '');
    } else {
      resetForm();
    }
  }, [editingPost, open]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, slug')
        .eq('status', 'active')
        .limit(50);
      setProducts(data || []);
    };
    fetchProducts();
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setContentType('plain');
    setSelectedPlatforms([]);
    setProductId('');
    setScheduledAt('');
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const getPlatformIcon = (iconName: string) => {
    switch (iconName) {
      case 'Instagram':
        return <Instagram className="h-4 w-4" />;
      case 'Facebook':
        return <Facebook className="h-4 w-4" />;
      case 'Twitter':
        return <Twitter className="h-4 w-4" />;
      case 'Youtube':
        return <Youtube className="h-4 w-4" />;
      case 'Music':
        return <Music className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!title || !content || selectedPlatforms.length === 0) {
      return;
    }

    setIsSubmitting(true);

    const postData: {
      title: string;
      content: string;
      content_type: 'plain' | 'product' | 'news' | 'promo' | 'announcement';
      platforms: string[];
      product_id: string | null;
      scheduled_at: string | null;
      status: 'draft' | 'scheduled' | 'published' | 'failed';
    } = {
      title,
      content,
      content_type: contentType,
      platforms: selectedPlatforms,
      product_id: contentType === 'product' && productId ? productId : null,
      scheduled_at: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'draft',
    };

    let success = false;
    if (editingPost) {
      success = await updatePost(editingPost.id, postData);
    } else {
      const result = await createPost(postData);
      success = !!result;
    }

    setIsSubmitting(false);

    if (success) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPost ? 'Edit Post' : 'Create Social Media Post'}</DialogTitle>
          <DialogDescription>
            Create content to share across your social media platforms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {contentType === 'product' && (
            <div className="space-y-2">
              <Label htmlFor="product">Select Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product to share" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Write your post content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Share to Platforms</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlatforms.includes(platform.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => handlePlatformToggle(platform.id)}
                >
                  <Checkbox
                    checked={selectedPlatforms.includes(platform.id)}
                    onCheckedChange={() => handlePlatformToggle(platform.id)}
                  />
                  <div className="flex items-center gap-2" style={{ color: platform.color }}>
                    {getPlatformIcon(platform.icon)}
                    <span className="text-foreground text-sm">{platform.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule Post (Optional)</Label>
            <Input
              id="schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to save as draft
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title || !content || selectedPlatforms.length === 0}
          >
            {isSubmitting
              ? 'Saving...'
              : editingPost
              ? 'Update Post'
              : scheduledAt
              ? 'Schedule Post'
              : 'Save as Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
