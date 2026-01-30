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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Instagram, Facebook, Twitter, Youtube, Music, Send, Clock, FileText } from 'lucide-react';

type PublishOption = 'draft' | 'now' | 'scheduled';

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
  const [publishOption, setPublishOption] = useState<PublishOption>('draft');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [externalPostUrl, setExternalPostUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setContentType(editingPost.content_type);
      setSelectedPlatforms(editingPost.platforms || []);
      setProductId(editingPost.product_id || '');
      // Determine publish option from existing post
      if (editingPost.status === 'published') {
        setPublishOption('now');
      } else if (editingPost.scheduled_at) {
        setPublishOption('scheduled');
        setScheduledAt(editingPost.scheduled_at);
      } else {
        setPublishOption('draft');
      }
      setScheduledAt(editingPost.scheduled_at || '');
      setExternalPostUrl(editingPost.external_post_url || '');
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
    setPublishOption('draft');
    setScheduledAt('');
    setExternalPostUrl('');
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

    // Validate scheduled time if scheduling
    if (publishOption === 'scheduled' && !scheduledAt) {
      return;
    }

    setIsSubmitting(true);

    // Determine status and timestamps based on publish option
    let status: 'draft' | 'scheduled' | 'published' | 'failed' = 'draft';
    let scheduled_at: string | null = null;
    let published_at: string | null = null;

    if (publishOption === 'now') {
      status = 'published';
      published_at = new Date().toISOString();
    } else if (publishOption === 'scheduled') {
      status = 'scheduled';
      scheduled_at = scheduledAt;
    }

    const postData: {
      title: string;
      content: string;
      content_type: 'plain' | 'product' | 'news' | 'promo' | 'announcement';
      platforms: string[];
      product_id: string | null;
      scheduled_at: string | null;
      published_at?: string | null;
      external_post_url: string | null;
      status: 'draft' | 'scheduled' | 'published' | 'failed';
    } = {
      title,
      content,
      content_type: contentType,
      platforms: selectedPlatforms,
      product_id: contentType === 'product' && productId ? productId : null,
      scheduled_at,
      external_post_url: externalPostUrl || null,
      status,
    };

    // Add published_at only when publishing now
    if (publishOption === 'now') {
      postData.published_at = published_at;
    }

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

          <div className="space-y-3">
            <Label>Publish Option</Label>
            <RadioGroup
              value={publishOption}
              onValueChange={(value) => setPublishOption(value as PublishOption)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="draft" id="draft" />
                <Label htmlFor="draft" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Save as Draft</div>
                    <div className="text-xs text-muted-foreground">Save without publishing</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Send className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium">Publish Now</div>
                    <div className="text-xs text-muted-foreground">Publish immediately to selected platforms</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-medium">Schedule for Later</div>
                    <div className="text-xs text-muted-foreground">Set a specific date and time</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {publishOption === 'scheduled' && (
              <div className="ml-8 mt-2">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalUrl">External Post URL (after publishing)</Label>
            <Input
              id="externalUrl"
              placeholder="https://instagram.com/p/..."
              value={externalPostUrl}
              onChange={(e) => setExternalPostUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Add the published post URL for mining task verification
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || 
              !title || 
              !content || 
              selectedPlatforms.length === 0 ||
              (publishOption === 'scheduled' && !scheduledAt)
            }
          >
            {isSubmitting
              ? 'Saving...'
              : editingPost
              ? 'Update Post'
              : publishOption === 'now'
              ? 'Publish Now'
              : publishOption === 'scheduled'
              ? 'Schedule Post'
              : 'Save as Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
