import React, { useState, useEffect } from 'react';
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
import { Plus, Send, Edit, Trash2, User, Share2, Users, Link, RefreshCw } from 'lucide-react';
import { useInfluencer } from '@/hooks/useInfluencer';
import { SocialPostModal } from './social/SocialPostModal';
import { ApprovedAccountsManager } from './social/ApprovedAccountsManager';
import { InfluencerManager } from './social/InfluencerManager';
import { ConnectedAccountsList } from './social/ConnectedAccountsList';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface PostWithAuthor {
  id: string;
  title: string;
  content: string;
  content_type: string;
  platforms: string[];
  status: string;
  created_at: string;
  created_by: string;
  author_name?: string;
  author_email?: string;
  author_role?: string;
}

const AdminSocialMedia: React.FC = () => {
  const { posts, loading, deletePost, publishPost, refreshPosts } = useInfluencer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [postsWithAuthors, setPostsWithAuthors] = useState<PostWithAuthor[]>([]);
  const [refreshingAuthors, setRefreshingAuthors] = useState(false);

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

  const fetchAuthors = async () => {
    if (posts.length === 0) {
      setPostsWithAuthors([]);
      return;
    }

    setRefreshingAuthors(true);
    try {
      const authorIds = [...new Set(posts.map(p => p.created_by))];
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('id', authorIds);

      // Fetch influencer profiles to get display names
      const { data: influencerProfiles } = await supabase
        .from('influencer_profiles')
        .select('user_id, display_name')
        .in('user_id', authorIds);

      // Check which authors are influencers
      const { data: influencers } = await supabase
        .from('influencer_profiles')
        .select('user_id')
        .in('user_id', authorIds);

      const influencerIds = new Set(influencers?.map(i => i.user_id) || []);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const influencerDisplayNames = new Map(
        influencerProfiles?.map(ip => [ip.user_id, ip.display_name]) || []
      );

      const enhanced = posts.map(post => {
        const isInfluencer = influencerIds.has(post.created_by);
        const profile = profileMap.get(post.created_by);
        // Use influencer display name if available, otherwise fall back to profile name
        const displayName = isInfluencer 
          ? (influencerDisplayNames.get(post.created_by) || profile?.name || 'Unknown')
          : (profile?.name || 'Unknown');
        
        return {
          ...post,
          author_name: displayName,
          author_email: profile?.email || '',
          author_role: isInfluencer ? 'influencer' : profile?.role || 'admin',
        };
      });

      setPostsWithAuthors(enhanced);
    } finally {
      setRefreshingAuthors(false);
    }
  };

  // Fetch author info for posts including influencer display names
  useEffect(() => {
    fetchAuthors();
  }, [posts]);

  const handleRefreshAuthors = () => {
    fetchAuthors();
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

  const getAuthorBadge = (role?: string) => {
    if (role === 'influencer') {
      return <Badge className="bg-purple-500">Influencer</Badge>;
    }
    return <Badge variant="secondary">Admin</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Social Media Management</h2>
          <p className="text-muted-foreground">Manage posts, accounts, and influencers</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefreshAuthors}
            disabled={refreshingAuthors}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAuthors ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setEditingPost(null); setIsModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Connected Accounts
          </TabsTrigger>
          <TabsTrigger value="manage-accounts" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Manage Accounts
          </TabsTrigger>
          <TabsTrigger value="influencers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Influencers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Posts</CardTitle>
              <CardDescription>
                All posts from admins and influencers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : postsWithAuthors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No posts yet. Create your first post!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Platforms</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postsWithAuthors.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium">{post.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{post.author_name}</span>
                                {getAuthorBadge(post.author_role)}
                              </div>
                              <div className="text-xs text-muted-foreground">{post.author_email}</div>
                            </div>
                          </div>
                        </TableCell>
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
                                title="Publish"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(post)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(post.id)}
                              title="Delete"
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

        <TabsContent value="accounts">
          <ConnectedAccountsList />
        </TabsContent>

        <TabsContent value="manage-accounts">
          <ApprovedAccountsManager />
        </TabsContent>

        <TabsContent value="influencers">
          <InfluencerManager />
        </TabsContent>
      </Tabs>

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

export default AdminSocialMedia;
