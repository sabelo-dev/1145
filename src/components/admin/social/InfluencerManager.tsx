import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Users, Crown, Settings, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { InfluencerApplications } from './InfluencerApplications';
import { InfluencerActivityCard } from './InfluencerActivityCard';

interface InfluencerProfile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  can_post: boolean;
  can_schedule: boolean;
  can_manage_accounts: boolean;
  platforms_access: string[];
  is_active: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
  posts_count?: number;
}

export const InfluencerManager: React.FC = () => {
  const { toast } = useToast();
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchInfluencers = useCallback(async () => {
    try {
      // Fetch influencer profiles first
      const { data: influencerData, error: influencerError } = await supabase
        .from('influencer_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (influencerError) {
        console.error('Error fetching influencer profiles:', influencerError);
        throw influencerError;
      }

      if (!influencerData || influencerData.length === 0) {
        setInfluencers([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs for profile lookup
      const userIds = [...new Set(influencerData.map(inf => inf.user_id))];

      // Fetch profiles separately to avoid RLS join issues
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user_id to profile data
      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, { name: p.name, email: p.email }])
      );

      // Get post counts for each influencer
      const { data: posts } = await supabase
        .from('social_media_posts')
        .select('created_by');

      const postCounts = (posts || []).reduce((acc, post) => {
        acc[post.created_by] = (acc[post.created_by] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Merge data
      const formatted = influencerData.map((inf: any) => ({
        ...inf,
        user_name: profileMap.get(inf.user_id)?.name || 'Unknown',
        user_email: profileMap.get(inf.user_id)?.email || '',
        posts_count: postCounts[inf.user_id] || 0,
      }));

      setInfluencers(formatted);
    } catch (error) {
      console.error('Error fetching influencers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  const handleSearch = async () => {
    if (!searchEmail) return;
    
    setIsSearching(true);
    setFoundUser(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('email', searchEmail)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const { data: existing } = await supabase
          .from('influencer_profiles')
          .select('id')
          .eq('user_id', data.id)
          .maybeSingle();

        if (existing) {
          toast({
            variant: 'destructive',
            title: 'Already an Influencer',
            description: 'This user is already assigned as an influencer.',
          });
        } else {
          setFoundUser(data);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'User Not Found',
          description: 'No user found with this email address.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to search for user',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssignInfluencer = async () => {
    if (!foundUser) return;

    setIsAssigning(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { error: profileError } = await supabase
        .from('influencer_profiles')
        .insert({
          user_id: foundUser.id,
          display_name: foundUser.name,
          assigned_by: currentUser?.id,
        });

      if (profileError) throw profileError;

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', foundUser.id)
        .eq('role', 'consumer');

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: foundUser.id,
          role: 'influencer',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Role error:', roleError);
      }

      await supabase
        .from('profiles')
        .update({ role: 'influencer' })
        .eq('id', foundUser.id);

      toast({
        title: 'Influencer Assigned',
        description: `${foundUser.name || foundUser.email} has been assigned as an influencer.`,
      });

      setIsAddDialogOpen(false);
      setSearchEmail('');
      setFoundUser(null);
      fetchInfluencers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign influencer',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveInfluencer = async (influencer: InfluencerProfile) => {
    if (!window.confirm('Are you sure you want to remove this influencer?')) return;

    try {
      const { error: profileError } = await supabase
        .from('influencer_profiles')
        .delete()
        .eq('id', influencer.id);

      if (profileError) throw profileError;

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', influencer.user_id)
        .eq('role', 'influencer');

      // Add back consumer role
      await supabase
        .from('user_roles')
        .insert({ user_id: influencer.user_id, role: 'consumer' });

      await supabase
        .from('profiles')
        .update({ role: 'consumer' })
        .eq('id', influencer.user_id);

      toast({
        title: 'Influencer Removed',
        description: 'The influencer has been removed and downgraded to consumer.',
      });

      fetchInfluencers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to remove influencer',
      });
    }
  };

  const handleToggleActive = async (influencerId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('influencer_profiles')
        .update({ is_active: isActive })
        .eq('id', influencerId);

      if (error) throw error;

      toast({
        title: isActive ? 'Influencer Activated' : 'Influencer Deactivated',
        description: `The influencer has been ${isActive ? 'activated' : 'deactivated'}.`,
      });

      fetchInfluencers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update status',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Activity & Analytics Section */}
      <InfluencerActivityCard />

      {/* Applications Section */}
      <InfluencerApplications onApproved={fetchInfluencers} />

      {/* Current Influencers */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Current Influencers
              </CardTitle>
              <CardDescription>
                Active influencers managing social media content
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchInfluencers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Influencer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {influencers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No influencers assigned yet.</p>
              <p className="text-sm">Add users to manage social media posts.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Posts</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {influencers.map((inf) => (
                  <TableRow key={inf.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{inf.user_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{inf.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{inf.display_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inf.posts_count} posts</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {inf.can_post && <Badge variant="outline">Post</Badge>}
                        {inf.can_schedule && <Badge variant="outline">Schedule</Badge>}
                        {inf.can_manage_accounts && <Badge variant="outline">Accounts</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {inf.is_active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(inf.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(inf.id, !inf.is_active)}
                          title={inf.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => handleRemoveInfluencer(inf)}
                          title="Remove influencer"
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Influencer</DialogTitle>
            <DialogDescription>
              Search for a user by email to assign them as an influencer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <Button onClick={handleSearch} disabled={isSearching || !searchEmail}>
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {foundUser && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">User Found</h4>
                <p className="text-sm text-muted-foreground">{foundUser.name || 'No name'}</p>
                <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current role: {foundUser.role}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignInfluencer}
              disabled={!foundUser || isAssigning}
            >
              {isAssigning ? 'Assigning...' : 'Assign as Influencer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
