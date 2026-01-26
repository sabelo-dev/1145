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
import { Plus, Send, Calendar, Edit, Trash2, Users, CheckCircle, XCircle } from 'lucide-react';
import { useInfluencer } from '@/hooks/useInfluencer';
import { SocialPostModal } from './social/SocialPostModal';
import { ApprovedAccountsManager } from './social/ApprovedAccountsManager';
import { InfluencerManager } from './social/InfluencerManager';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';

const AdminSocialMedia: React.FC = () => {
  const { posts, loading, deletePost, publishPost, refreshPosts } = useInfluencer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Social Media Management</h2>
          <p className="text-muted-foreground">Create and manage social media posts across platforms</p>
        </div>
        <Button onClick={() => { setEditingPost(null); setIsModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="accounts">Approved Accounts</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Posts</CardTitle>
              <CardDescription>
                Manage posts to be shared across social platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                    {posts.map((post) => (
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

        <TabsContent value="accounts">
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
