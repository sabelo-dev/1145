import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Heart, MessageCircle, Share2, Eye, ExternalLink, Search,
  Image, Video, FileText, Link2, Filter, TrendingUp, Bookmark
} from 'lucide-react';
import type { NormalizedPost } from '@/hooks/useInfluencerDashboard';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const PLATFORM_CONFIG: Record<string, { color: string; label: string }> = {
  instagram: { color: '#E4405F', label: 'Instagram' },
  facebook: { color: '#1877F2', label: 'Facebook' },
  twitter: { color: '#000000', label: 'X' },
  tiktok: { color: '#010101', label: 'TikTok' },
  youtube: { color: '#FF0000', label: 'YouTube' },
};

const CONTENT_ICONS: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  reel: Video,
  story: Image,
  text: FileText,
  carousel: Image,
};

interface ContentFeedProps {
  posts: NormalizedPost[];
  onSelectPost: (post: NormalizedPost) => void;
  onLinkProduct: (postId: string) => void;
  selectedPostId?: string;
}

export const ContentFeed: React.FC<ContentFeedProps> = ({
  posts,
  onSelectPost,
  onLinkProduct,
  selectedPostId,
}) => {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'engagement'>('recent');

  const filtered = posts
    .filter(p => {
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (search && !p.caption?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'engagement') {
        const engA = (a.metrics?.likes || 0) + (a.metrics?.comments || 0);
        const engB = (b.metrics?.likes || 0) + (b.metrics?.comments || 0);
        return engB - engA;
      }
      return new Date(b.posted_at || b.created_at).getTime() - new Date(a.posted_at || a.created_at).getTime();
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Content Feed
        </h3>
        <Badge variant="secondary">{filtered.length} posts</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {Object.entries(PLATFORM_CONFIG).map(([id, cfg]) => (
              <SelectItem key={id} value={id}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-[150px]">
            <TrendingUp className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="engagement">Top Engagement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Post Cards */}
      <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No posts found. Connect your social accounts to sync content.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((post, i) => {
              const platform = PLATFORM_CONFIG[post.platform] || { color: '#666', label: post.platform };
              const ContentIcon = CONTENT_ICONS[post.content_type] || FileText;
              const isSelected = selectedPostId === post.id;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-primary shadow-md' : ''
                    }`}
                    onClick={() => onSelectPost(post)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {/* Media Preview */}
                        {post.media_url ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={post.media_url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <ContentIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Platform & Type */}
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: platform.color, color: platform.color }}
                            >
                              {platform.label}
                            </Badge>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {post.content_type}
                            </Badge>
                            {post.linked_product_id && (
                              <Badge className="text-xs bg-emerald-500">
                                <Link2 className="h-3 w-3 mr-1" />
                                Linked
                              </Badge>
                            )}
                          </div>

                          {/* Caption */}
                          <p className="text-sm line-clamp-2 text-foreground">
                            {post.caption || 'No caption'}
                          </p>

                          {/* Metrics Row */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {post.metrics?.likes?.toLocaleString() || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {post.metrics?.comments?.toLocaleString() || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="h-3 w-3" />
                              {post.metrics?.shares?.toLocaleString() || 0}
                            </span>
                            {post.metrics?.reach > 0 && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {post.metrics.reach.toLocaleString()}
                              </span>
                            )}
                            <span className="ml-auto">
                              {post.posted_at
                                ? format(new Date(post.posted_at), 'MMM d')
                                : format(new Date(post.created_at), 'MMM d')}
                            </span>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-col gap-1">
                          {post.permalink && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={e => {
                                e.stopPropagation();
                                window.open(post.permalink!, '_blank');
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!post.linked_product_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={e => {
                                e.stopPropagation();
                                onLinkProduct(post.id);
                              }}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
