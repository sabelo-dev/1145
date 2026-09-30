import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CheckCircle2, Clock, ExternalLink, FileText, Loader2, Pencil, Send, Sparkles, Trash2,
} from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/cms/DeleteConfirmDialog';
import { SOCIAL_PLATFORMS, type SocialMediaPost } from '@/types/influencer';

interface MyPostsPanelProps {
  posts: SocialMediaPost[];
  canPost: boolean;
  onCreate: () => void;
  onEdit: (post: SocialMediaPost) => void;
  onPublish: (postId: string) => Promise<boolean>;
  onDelete: (postId: string) => Promise<boolean>;
}

const STATUS_STYLES: Record<SocialMediaPost['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  published: { label: 'Published', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  partial: { label: 'Partly published', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  failed: { label: 'Failed', className: 'bg-destructive/15 text-destructive' },
};

const platformName = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.name ?? id;

export const MyPostsPanel: React.FC<MyPostsPanelProps> = ({
  posts, canPost, onCreate, onEdit, onPublish, onDelete,
}) => {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SocialMediaPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePublish = async (postId: string) => {
    setPublishingId(postId);
    try {
      await onPublish(postId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    const ok = await onDelete(toDelete.id);
    setIsDeleting(false);
    if (ok) setToDelete(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg">My Posts</CardTitle>
          <CardDescription>Drafts, scheduled and published posts you created here</CardDescription>
        </div>
        {canPost && (
          <Button size="sm" onClick={onCreate}>
            <Sparkles className="h-4 w-4 mr-2" />
            New post
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No posts yet.</p>
            {canPost && <p className="text-sm mt-1">Create a post and publish it to your connected accounts.</p>}
          </div>
        ) : (
          posts.map((post) => {
            const status = STATUS_STYLES[post.status] ?? STATUS_STYLES.draft;
            const results = post.platform_results ?? [];
            const canPublish = post.status !== 'published';
            const isPublishing = publishingId === post.id;
            const thumb = post.media_urls?.[0];

            return (
              <div key={post.id} className="rounded-lg border p-3 sm:p-4 space-y-3">
                <div className="flex gap-3">
                  {thumb && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {/\.(mp4|mov|m4v)(\?|$)/i.test(thumb) ? (
                        <video src={thumb} className="h-full w-full object-cover" muted preload="metadata" />
                      ) : (
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium truncate">{post.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {post.status === 'scheduled' && post.scheduled_at
                        ? `Scheduled for ${format(new Date(post.scheduled_at), 'MMM d, yyyy HH:mm')}`
                        : post.published_at
                          ? `Published ${format(new Date(post.published_at), 'MMM d, yyyy HH:mm')}`
                          : `Created ${format(new Date(post.created_at), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(post.platforms || []).map((platform) => {
                    const result = results.find((r) => r.platform === platform);
                    const published = result?.status === 'published' || !!post.external_post_ids?.[platform];
                    // Without a per-platform row, fall back to the post's own outcome.
                    const failed = result ? result.status === 'failed' : !published && post.status === 'failed';
                    return (
                      <Badge
                        key={platform}
                        variant="outline"
                        className={published ? 'border-green-500/50' : failed ? 'border-destructive/50' : ''}
                      >
                        {published ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                        ) : failed ? (
                          <AlertCircle className="h-3 w-3 mr-1 text-destructive" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                        )}
                        {platformName(platform)}
                        {published && result?.external_post_url && (
                          <a
                            href={result.external_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 inline-flex"
                            aria-label={`Open on ${platformName(platform)}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </Badge>
                    );
                  })}
                </div>

                {results.some((r) => r.status === 'failed' && r.error_message) && (
                  <ul className="space-y-1 rounded-md bg-destructive/5 p-2 text-xs text-destructive">
                    {results
                      .filter((r) => r.status === 'failed' && r.error_message)
                      .map((r) => (
                        <li key={r.platform}>
                          <span className="font-medium">{platformName(r.platform)}:</span> {r.error_message}
                        </li>
                      ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  {canPublish && canPost && (
                    <Button size="sm" onClick={() => handlePublish(post.id)} disabled={isPublishing}>
                      {isPublishing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {post.status === 'failed' || post.status === 'partial' ? 'Retry publish' : 'Publish now'}
                    </Button>
                  )}
                  {post.external_post_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={post.external_post_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onEdit(post)} disabled={isPublishing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(post)}
                    disabled={isPublishing}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete post"
        description={`Delete "${toDelete?.title}"? This only removes it from 1145, not from the social platforms.`}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </Card>
  );
};
