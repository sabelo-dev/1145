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
import { Instagram, Facebook, Twitter, Youtube, Music, Send, Clock, FileText, Zap, ImagePlus, X, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Platforms social-publish can post to automatically.
const API_PLATFORMS = new Set(['facebook', 'instagram', 'twitter']);

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type PublishOption = 'draft' | 'now' | 'scheduled' | 'api_now';

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
  const { createPost, updatePost, publishPost } = useInfluencer();
  const { user } = useAuth();
  const { toast } = useToast();
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
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
      setMediaUrls(editingPost.media_urls || []);
      // Determine publish option from existing post
      if (editingPost.status === 'published') {
        setPublishOption('now');
      } else if (editingPost.scheduled_at) {
        setPublishOption('scheduled');
      } else {
        setPublishOption('draft');
      }
      setScheduledAt(editingPost.scheduled_at ? toLocalInput(editingPost.scheduled_at) : '');
      setExternalPostUrl(editingPost.external_post_url || '');
    } else {
      resetForm();
    }
  }, [editingPost, open]);

  useEffect(() => {
    const fetchProducts = async () => {
      // Published products are 'approved' (set by admin review); some older
      // rows use 'active'. Load the whole live catalogue, not a first page.
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, product_images(image_url, position)')
        .in('status', ['approved', 'active'])
        .order('name', { ascending: true })
        .limit(1000);
      if (error) console.error('Failed to load products:', error);
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
    setMediaUrls([]);
    setMediaUrlInput('');
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from('social-media')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploaded.push(supabase.storage.from('social-media').getPublicUrl(path).data.publicUrl);
      }
      setMediaUrls((prev) => [...prev, ...uploaded].slice(0, 10));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!/^https:\/\//i.test(url)) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Media must be a public https:// link.' });
      return;
    }
    setMediaUrls((prev) => [...prev, url].slice(0, 10));
    setMediaUrlInput('');
  };

  const manualOnlyPlatforms = selectedPlatforms.filter((p) => !API_PLATFORMS.has(p));
  // A product promotion without media goes out with the product's own photo (see social-publish).
  const selectedProduct = contentType === 'product' ? products.find((p) => p.id === productId) : undefined;
  const productPhoto: string | undefined = [...(selectedProduct?.product_images ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.image_url;
  const usesProductPhoto = mediaUrls.length === 0 && !!productPhoto;
  const instagramNeedsMedia =
    selectedPlatforms.includes('instagram') && mediaUrls.length === 0 && !usesProductPhoto;

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

    let status: 'draft' | 'scheduled' | 'published' | 'failed' = 'draft';
    let scheduled_at: string | null = null;
    let published_at: string | null = null;
    let publishViaApi = false;

    if (publishOption === 'now') {
      status = 'published';
      published_at = new Date().toISOString();
    } else if (publishOption === 'api_now') {
      status = 'draft'; // Will be updated by the API
      publishViaApi = true;
    } else if (publishOption === 'scheduled') {
      status = 'scheduled';
      scheduled_at = new Date(scheduledAt).toISOString();
    }

    const postData: {
      title: string;
      content: string;
      content_type: 'plain' | 'product' | 'news' | 'promo' | 'announcement';
      platforms: string[];
      media_urls: string[];
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
      media_urls: mediaUrls,
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
    let createdPost = null;
    if (editingPost) {
      success = await updatePost(editingPost.id, postData);
      if (success && publishViaApi) {
        await publishPost(editingPost.id, true);
      }
    } else {
      const result = await createPost(postData);
      success = !!result;
      createdPost = result;
      if (success && publishViaApi && result) {
        await publishPost(result.id, true);
      }
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
              <p className="text-xs text-muted-foreground">
                Your share link to this product is added to the end of the post when it is published. Instagram can't show clickable links, so there the post points to the link in your bio instead.
              </p>
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
            <Label>Media</Label>
            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {mediaUrls.map((url, i) => (
                  <div key={url + i} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                    {/\.(mp4|mov|m4v)(\?|$)/i.test(url) ? (
                      <video src={url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove media"
                      className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5"
                      onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {usesProductPhoto && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
                <img src={productPhoto} alt="" className="h-12 w-12 shrink-0 rounded-md border object-cover" />
                <p className="min-w-0 text-xs text-muted-foreground">
                  No media added, so the product photo will be used on Facebook and Instagram. Add your own to replace it.
                </p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" asChild disabled={isUploading || mediaUrls.length >= 10}>
                <label className="cursor-pointer">
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                  Upload
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    multiple
                    className="hidden"
                    disabled={isUploading || mediaUrls.length >= 10}
                    onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
                  />
                </label>
              </Button>
              <Input
                placeholder="or paste a public image/video URL"
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMediaUrl(); } }}
              />
              <Button type="button" variant="secondary" onClick={addMediaUrl} disabled={!mediaUrlInput.trim()}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Up to 10 items. Instagram needs at least one image or video (JPEG recommended); product posts can use the product photo.
            </p>
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

          {publishOption === 'api_now' && (instagramNeedsMedia || manualOnlyPlatforms.length > 0) && (
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                {instagramNeedsMedia && <p>Instagram will fail without an image or video.</p>}
                {manualOnlyPlatforms.length > 0 && (
                  <p>
                    {manualOnlyPlatforms.join(', ')} can't be published automatically yet. Post there yourself,
                    then add the link below.
                  </p>
                )}
              </div>
            </div>
          )}

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
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer">
                <RadioGroupItem value="api_now" id="api_now" />
                <Label htmlFor="api_now" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Publish via API</div>
                    <div className="text-xs text-muted-foreground">Post directly to connected social accounts using APIs</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Send className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium">Mark as Published</div>
                    <div className="text-xs text-muted-foreground">Mark as published (manual posting)</div>
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
              : publishOption === 'api_now'
              ? 'Publish via API'
              : publishOption === 'now'
              ? 'Mark as Published'
              : publishOption === 'scheduled'
              ? 'Schedule Post'
              : 'Save as Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
