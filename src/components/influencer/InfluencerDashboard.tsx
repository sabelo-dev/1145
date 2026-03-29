import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Crown, LogOut, FileText, MessageCircle, BarChart3, DollarSign,
  Settings, Link2, Loader2, RefreshCw, Sparkles, Bell
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useInfluencerDashboard } from '@/hooks/useInfluencerDashboard';
import { SocialPostModal } from '@/components/admin/social/SocialPostModal';
import { ContentFeed } from './dashboard/ContentFeed';
import { CommentsInbox } from './dashboard/CommentsInbox';
import { EngagementConsole } from './dashboard/EngagementConsole';
import { MoneyView } from './dashboard/MoneyView';
import { SyncStatusPanel } from './dashboard/SyncStatusPanel';
import { InfluencerAccountsTab } from './InfluencerAccountsTab';
import { InfluencerSettingsTab } from './InfluencerSettingsTab';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { NormalizedPost } from '@/hooks/useInfluencerDashboard';

const InfluencerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { posts, profile, loading: legacyLoading, deletePost, publishPost, refreshPosts } = useInfluencer();
  const dashboard = useInfluencerDashboard();

  const [activeTab, setActiveTab] = useState('feed');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<NormalizedPost | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const loading = legacyLoading || dashboard.loading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Influencer Hub</h1>
                <p className="text-xs text-muted-foreground">
                  {profile?.display_name || user?.name || user?.email}
                  {profile?.username && (
                    <span className="text-primary ml-1">@{profile.username}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-3 mr-4">
                {dashboard.stats.unhandledComments > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    <Bell className="h-3 w-3 mr-1" />
                    {dashboard.stats.unhandledComments} unread
                  </Badge>
                )}
                <Badge variant="secondary">
                  {dashboard.stats.postCount} posts
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={dashboard.refresh}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="feed" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-1.5 text-xs sm:text-sm relative">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Inbox</span>
              {dashboard.stats.unhandledComments > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                  {dashboard.stats.unhandledComments > 9 ? '9+' : dashboard.stats.unhandledComments}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Engagement</span>
            </TabsTrigger>
            <TabsTrigger value="money" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Money</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Content Feed + Comments Split View */}
          <TabsContent value="feed">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <ContentFeed
                  posts={dashboard.socialPosts}
                  onSelectPost={setSelectedPost}
                  onLinkProduct={(postId) => {
                    // TODO: Open product linking modal
                  }}
                  selectedPostId={selectedPost?.id}
                />
              </div>
              <div className="space-y-4">
                <SyncStatusPanel syncStatuses={dashboard.syncStatuses} />
                
                {/* Quick actions */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="text-sm font-medium">Quick Actions</h4>
                    {profile?.can_post && (
                      <Button
                        className="w-full"
                        onClick={() => { setEditingPost(null); setIsModalOpen(true); }}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create Post
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab('inbox')}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Open Inbox
                      {dashboard.stats.unhandledComments > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {dashboard.stats.unhandledComments}
                        </Badge>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Comments Inbox */}
          <TabsContent value="inbox">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <CommentsInbox
                  comments={dashboard.comments}
                  posts={dashboard.socialPosts}
                  suggestions={dashboard.suggestions}
                  onMarkHandled={dashboard.markCommentHandled}
                  onMarkSpam={dashboard.markCommentSpam}
                  selectedPostId={selectedPost?.id}
                />
              </div>
              <div>
                {/* Post selector for filtering comments */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">Filter by Post</h4>
                    <Button
                      variant={selectedPost ? 'outline' : 'secondary'}
                      size="sm"
                      className="w-full mb-2"
                      onClick={() => setSelectedPost(null)}
                    >
                      All Posts
                    </Button>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {dashboard.socialPosts.slice(0, 10).map(post => {
                        const commentCount = dashboard.comments.filter(c => c.post_id === post.id).length;
                        return (
                          <Button
                            key={post.id}
                            variant={selectedPost?.id === post.id ? 'default' : 'ghost'}
                            size="sm"
                            className="w-full justify-start text-left h-auto py-2"
                            onClick={() => setSelectedPost(post)}
                          >
                            <div className="min-w-0">
                              <p className="text-xs truncate">{post.caption?.slice(0, 40) || 'Post'}</p>
                              <p className="text-[10px] text-muted-foreground">{commentCount} comments</p>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Engagement Console */}
          <TabsContent value="engagement">
            <EngagementConsole metrics={dashboard.metrics} stats={dashboard.stats} />
          </TabsContent>

          {/* Money View */}
          <TabsContent value="money">
            <MoneyView
              conversions={dashboard.conversions}
              metrics={dashboard.metrics}
              posts={dashboard.socialPosts}
              stats={dashboard.stats}
            />
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <InfluencerAccountsTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <InfluencerSettingsTab profile={profile} />
          </TabsContent>
        </Tabs>
      </main>

      <SocialPostModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingPost={editingPost}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingPost(null);
          refreshPosts();
          dashboard.refresh();
        }}
      />
    </div>
  );
};

export default InfluencerDashboard;
