import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageCircle, Send, Check, Ban, Sparkles, ExternalLink,
  Filter, AlertTriangle, Star, Clock, ChevronRight
} from 'lucide-react';
import type { NormalizedComment, NormalizedPost, AISuggestion } from '@/hooks/useInfluencerDashboard';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const SENTIMENT_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  positive: { color: 'text-emerald-500', icon: Star, label: 'Positive' },
  negative: { color: 'text-red-500', icon: AlertTriangle, label: 'Negative' },
  neutral: { color: 'text-muted-foreground', icon: MessageCircle, label: 'Neutral' },
  question: { color: 'text-blue-500', icon: MessageCircle, label: 'Question' },
};

interface CommentsInboxProps {
  comments: NormalizedComment[];
  posts: NormalizedPost[];
  suggestions: AISuggestion[];
  onMarkHandled: (commentId: string, replyText?: string) => Promise<boolean>;
  onMarkSpam: (commentId: string) => void;
  selectedPostId?: string;
}

export const CommentsInbox: React.FC<CommentsInboxProps> = ({
  comments,
  posts,
  suggestions,
  onMarkHandled,
  onMarkSpam,
  selectedPostId,
}) => {
  const [filter, setFilter] = useState<'all' | 'unhandled' | 'high_value' | 'negative'>('unhandled');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const filteredComments = useMemo(() => {
    let result = selectedPostId
      ? comments.filter(c => c.post_id === selectedPostId)
      : comments;

    result = result.filter(c => !c.is_spam);

    switch (filter) {
      case 'unhandled':
        return result.filter(c => !c.is_handled);
      case 'high_value':
        return result.filter(c => c.is_high_value);
      case 'negative':
        return result.filter(c => c.sentiment === 'negative');
      default:
        return result;
    }
  }, [comments, selectedPostId, filter]);

  const handleReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    const success = await onMarkHandled(commentId, replyText.trim());
    if (success) {
      setReplyText('');
      setReplyingTo(null);
    }
    setSending(false);
  };

  const getPostForComment = (postId: string) => posts.find(p => p.id === postId);

  const getSuggestionForComment = (commentId: string) =>
    suggestions.find(s => s.comment_id === commentId && !s.is_used);

  const filterCounts = {
    all: comments.filter(c => !c.is_spam).length,
    unhandled: comments.filter(c => !c.is_handled && !c.is_spam).length,
    high_value: comments.filter(c => c.is_high_value && !c.is_spam).length,
    negative: comments.filter(c => c.sentiment === 'negative' && !c.is_spam).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Comments Inbox
        </h3>
        {filterCounts.unhandled > 0 && (
          <Badge variant="destructive">{filterCounts.unhandled} unread</Badge>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: 'unhandled', label: 'Unhandled', icon: Clock },
          { key: 'all', label: 'All', icon: MessageCircle },
          { key: 'high_value', label: 'High Value', icon: Star },
          { key: 'negative', label: 'Needs Attention', icon: AlertTriangle },
        ].map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key as any)}
            className="text-xs"
          >
            <f.icon className="h-3 w-3 mr-1" />
            {f.label}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">
              {filterCounts[f.key as keyof typeof filterCounts]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Comments List */}
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-2 pr-2">
          <AnimatePresence>
            {filteredComments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {filter === 'unhandled'
                      ? 'All comments handled! 🎉'
                      : 'No comments match this filter.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredComments.map((comment, i) => {
                const sentiment = SENTIMENT_CONFIG[comment.sentiment] || SENTIMENT_CONFIG.neutral;
                const SentimentIcon = sentiment.icon;
                const post = getPostForComment(comment.post_id);
                const suggestion = getSuggestionForComment(comment.id);
                const isReplying = replyingTo === comment.id;

                return (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Card className={`transition-all ${comment.is_high_value ? 'border-amber-500/50 bg-amber-500/5' : ''} ${comment.is_handled ? 'opacity-60' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={comment.user_avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {comment.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">@{comment.username}</span>
                              <SentimentIcon className={`h-3 w-3 ${sentiment.color}`} />
                              {comment.is_high_value && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDistanceToNow(new Date(comment.posted_at), { addSuffix: true })}
                              </span>
                            </div>

                            {/* Post reference */}
                            {post && (
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                on: <span className="truncate max-w-[200px]">{post.caption?.slice(0, 50) || 'Post'}</span>
                              </div>
                            )}

                            <p className="text-sm">{comment.text}</p>

                            {/* AI Suggestion */}
                            {suggestion && !comment.is_handled && (
                              <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                                <div className="flex items-center gap-1 text-xs text-primary mb-1">
                                  <Sparkles className="h-3 w-3" />
                                  AI Suggested Reply ({Math.round(suggestion.confidence * 100)}%)
                                </div>
                                <p className="text-xs text-muted-foreground">{suggestion.suggested_text}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-1 h-6 text-xs text-primary"
                                  onClick={() => {
                                    setReplyingTo(comment.id);
                                    setReplyText(suggestion.suggested_text);
                                  }}
                                >
                                  Use this reply
                                </Button>
                              </div>
                            )}

                            {/* Reply sent */}
                            {comment.is_replied && comment.reply_text && (
                              <div className="mt-2 p-2 rounded-md bg-muted">
                                <p className="text-xs text-muted-foreground">
                                  <Check className="h-3 w-3 inline mr-1 text-emerald-500" />
                                  Your reply: {comment.reply_text}
                                </p>
                              </div>
                            )}

                            {/* Reply input */}
                            {isReplying && (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  placeholder="Type your reply..."
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  rows={2}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleReply(comment.id)}
                                    disabled={sending || !replyText.trim()}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    {sending ? 'Sending...' : 'Reply & Mark Handled'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            {!comment.is_handled && !isReplying && (
                              <div className="flex gap-1 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => setReplyingTo(comment.id)}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => onMarkHandled(comment.id)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Done
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() => onMarkSpam(comment.id)}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Spam
                                </Button>
                              </div>
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
      </ScrollArea>
    </div>
  );
};
