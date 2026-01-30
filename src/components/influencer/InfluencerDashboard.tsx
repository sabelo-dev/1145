import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, Send, Calendar, Edit, Trash2, BarChart3, 
  FileText, Settings, LogOut, Crown 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInfluencer } from '@/hooks/useInfluencer';
import { SocialPostModal } from '@/components/admin/social/SocialPostModal';
import { InfluencerAccountsTab } from './InfluencerAccountsTab';
import { InfluencerSettingsTab } from './InfluencerSettingsTab';
import { InfluencerAnalyticsTab } from './InfluencerAnalyticsTab';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const InfluencerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { posts, profile, loading, deletePost, publishPost, refreshPosts } = useInfluencer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('posts');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500">Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const getPlatformBadges = (platforms: string[]) => {
    return platforms.map(p => {
      const platform = SOCIAL_PLATFORMS.find(sp => sp.id === p);
      return platform ? (
        <Badge 
          key={p} 
          variant="outline" 
          className="mr-1"
          style={{ borderColor: platform.color, color: platform.color }}
        >
          {platform.name}
        </Badge>
      ) : null;
    });
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    setIsModalOpen(true);
  };

  const handleDelete = async (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      await deletePost(postId);
    }
  };

  const handlePublish = async (postId: string) => {
    await publishPost(postId);
  };

  // Filter posts to only show user's own posts
  const myPosts = posts.filter(p => p.created_by === user?.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Influencer Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome, {profile?.display_name || user?.name || user?.email}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold">My Posts</h2>
                <p className="text-muted-foreground">Create and manage your social media content</p>
              </div>
              {profile?.can_post && (
                <Button onClick={() => { setEditingPost(null); setIsModalOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : myPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No posts yet. Create your first post!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Platforms</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myPosts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium">{post.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{post.content_type}</Badge>
                          </TableCell>
                          <TableCell>{getPlatformBadges(post.platforms)}</TableCell>
                          <TableCell>{getStatusBadge(post.status)}</TableCell>
                          <TableCell>{format(new Date(post.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {post.status === 'draft' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePublish(post.id)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(post)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(post.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <InfluencerAccountsTab />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <InfluencerAnalyticsTab posts={myPosts} />
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
        }}
      />
    </div>
  );
};

export default InfluencerDashboard;
