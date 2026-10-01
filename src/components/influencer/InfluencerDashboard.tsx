import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Crown, LogOut, FileText, MessageCircle, BarChart3, DollarSign,
  Settings, Link2, Loader2, RefreshCw, Sparkles, Bell, Send, Coins, Store, ShoppingCart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import CartSheet from '@/components/shop/CartSheet';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { useInfluencer } from '@/hooks/useInfluencer';
import { useInfluencerDashboard } from '@/hooks/useInfluencerDashboard';
import { SocialPostModal } from '@/components/admin/social/SocialPostModal';
import { ContentFeed } from './dashboard/ContentFeed';
import { CommentsInbox } from './dashboard/CommentsInbox';
import { EngagementConsole } from './dashboard/EngagementConsole';
import { MoneyView } from './dashboard/MoneyView';
import { SyncStatusPanel } from './dashboard/SyncStatusPanel';
import { MyPostsPanel } from './dashboard/MyPostsPanel';
import { InfluencerRewardsTab } from './dashboard/InfluencerRewardsTab';
import { InfluencerAccountsTab } from './InfluencerAccountsTab';
import { InfluencerSettingsTab } from './InfluencerSettingsTab';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { NormalizedPost } from '@/hooks/useInfluencerDashboard';
import type { SocialMediaPost } from '@/types/influencer';
import { useUrlTab } from "@/hooks/useUrlTab";

const InfluencerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { posts, profile, loading: legacyLoading, deletePost, publishPost, refreshPosts } = useInfluencer();
  const dashboard = useInfluencerDashboard();
  const { cart, toggleCart, isCartOpen, setCartOpen } = useCart();
  const cartCount = (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const [activeTab, setActiveTab] = useUrlTab('feed');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMediaPost | null>(null);
  const [selectedPost, setSelectedPost] = useState<NormalizedPost | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const loading = legacyLoading || dashboard.loading;

  const openCreate = () => { setEditingPost(null); setIsModalOpen(true); };
  const openEdit = (post: SocialMediaPost) => { setEditingPost(post); setIsModalOpen(true); };

  const handlePublish = async (postId: string) => {
    const ok = await publishPost(postId, true);
    // Published posts show up in the synced feed on the next sync.
    if (ok) dashboard.refresh();
    return ok;
  };

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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">Influencer Hub</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.display_name || user?.name || user?.email}
                  {profile?.username && (
                    <span className="text-primary ml-1">@{profile.username}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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

              {/* This page sits outside the store layout, so it carries its own way back to the
                  shop and cart. On phones the bottom nav covers the store, so Shop shows from md up. */}
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
                <Link to="/shop">
                  <Store className="h-4 w-4" />
                  Shop
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={toggleCart}
                aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'}
              >
                <ShoppingCart className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground ring-2 ring-background">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { dashboard.refresh(); refreshPosts(); }}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="px-3 sm:px-3.5" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-4 pb-nav md:pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* All 8 tabs share the width on phones (icon only) so none sit off-screen */}
          <TabsList className="grid h-auto min-h-11 w-full grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="feed" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <Send className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm relative">
              <MessageCircle className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Inbox</span>
              {dashboard.stats.unhandledComments > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[11px] text-destructive-foreground flex items-center justify-center">
                  {dashboard.stats.unhandledComments > 9 ? '9+' : dashboard.stats.unhandledComments}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Engagement</span>
            </TabsTrigger>
            <TabsTrigger value="money" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Money</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <Coins className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Rewards</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <Link2 className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 px-0 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Settings</span>
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
                <SyncStatusPanel
                  syncStatuses={dashboard.syncStatuses}
                  onSync={dashboard.syncContent}
                  syncing={dashboard.syncing}
                />
                
                {/* Quick actions */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="text-sm font-medium">Quick Actions</h4>
                    {profile?.can_post && (
                      <Button
                        className="w-full"
                        onClick={openCreate}
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

          {/* Posts created here, with publish / retry */}
          <TabsContent value="posts">
            <MyPostsPanel
              posts={posts}
              canPost={!!profile?.can_post}
              onCreate={openCreate}
              onEdit={openEdit}
              onPublish={handlePublish}
              onDelete={deletePost}
            />
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
                              <p className="text-[11px] text-muted-foreground">{commentCount} comments</p>
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

          {/* Tasks + UCoin rewards */}
          <TabsContent value="rewards">
            <InfluencerRewardsTab />
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

      <MobileBottomNav />

      <CartSheet isOpen={isCartOpen} setIsOpen={setCartOpen} />

      <SocialPostModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingPost={editingPost}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingPost(null);
          refreshPosts();
          dashboard.refresh();
          setActiveTab('posts');
        }}
      />
    </div>
  );
};

export default InfluencerDashboard;
