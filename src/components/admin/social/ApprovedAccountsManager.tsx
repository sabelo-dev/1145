import React, { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, CheckCircle, XCircle, ExternalLink, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';

interface ApprovedAccount {
  id: string;
  user_id: string;
  platform: string;
  account_handle: string;
  account_url?: string;
  is_verified: boolean;
  verified_at?: string;
  is_active: boolean;
  created_at: string;
  added_by_admin?: string;
  user_name?: string;
  user_email?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export const ApprovedAccountsManager: React.FC = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ApprovedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .select(`
          *,
          profiles:user_id (name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedAccounts = (data || []).map((acc: any) => ({
        ...acc,
        user_name: acc.profiles?.name,
        user_email: acc.profiles?.email,
      }));

      setAccounts(formattedAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .ilike('email', `%${searchEmail}%`)
        .limit(10);

      if (error) throw error;
      setUsers(data as UserOption[] || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!selectedUserId || !newPlatform || !newHandle) return;

    setIsSubmitting(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('approved_social_accounts')
        .insert({
          user_id: selectedUserId,
          platform: newPlatform,
          account_handle: newHandle,
          account_url: newUrl || null,
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: currentUser?.id,
          added_by_admin: currentUser?.id,
        });

      if (error) throw error;

      toast({
        title: 'Account Added',
        description: 'Social account has been added and verified.',
      });

      setIsAddDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add account',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setSearchEmail('');
    setUsers([]);
    setNewPlatform('');
    setNewHandle('');
    setNewUrl('');
  };

  const handleApprove = async (accountId: string, approve: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('approved_social_accounts')
        .update({
          is_verified: approve,
          verified_at: approve ? new Date().toISOString() : null,
          verified_by: approve ? user?.id : null,
        })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: approve ? 'Account Approved' : 'Approval Revoked',
        description: `The social account has been ${approve ? 'approved' : 'revoked'}.`,
      });

      fetchAccounts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update account',
      });
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;

    try {
      const { error } = await supabase
        .from('approved_social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: 'Account Deleted',
        description: 'The social account has been removed.',
      });

      fetchAccounts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete account',
      });
    }
  };

  const handleToggleActive = async (accountId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('approved_social_accounts')
        .update({ is_active: isActive })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: isActive ? 'Account Activated' : 'Account Deactivated',
        description: `The account has been ${isActive ? 'activated' : 'deactivated'}.`,
      });

      fetchAccounts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to toggle account status',
      });
    }
  };

  const getPlatformBadge = (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
    return platform ? (
      <Badge variant="outline" style={{ borderColor: platform.color, color: platform.color }}>
        {platform.name}
      </Badge>
    ) : (
      <Badge variant="outline">{platformId}</Badge>
    );
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
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Approved Social Accounts
              </CardTitle>
              <CardDescription>
                Add and manage social media accounts for users. Only admin-added accounts are shown to influencers.
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No social accounts added yet.</p>
              <p className="text-sm">Add accounts for users to enable social mining.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{account.user_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{account.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlatformBadge(account.platform)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        @{account.account_handle}
                        {account.account_url && (
                          <a
                            href={account.account_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {account.is_verified ? (
                          <Badge className="bg-green-500">Verified</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {!account.is_active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.added_by_admin ? (
                        <Badge variant="secondary">Admin Added</Badge>
                      ) : (
                        <Badge variant="outline">User Added</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(account.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!account.is_verified ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                            onClick={() => handleApprove(account.id, true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleApprove(account.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(account.id, !account.is_active)}
                        >
                          {account.is_active ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(account.id)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Social Account for User</DialogTitle>
            <DialogDescription>
              Add a verified social media account for a user. This account will be available for social mining tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search User by Email</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <Button type="button" onClick={searchUsers}>
                  Search
                </Button>
              </div>
            </div>

            {users.length > 0 && (
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">Username/Handle</Label>
              <Input
                id="handle"
                placeholder="@username"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value.replace('@', ''))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Profile URL (optional)</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAccount}
              disabled={isSubmitting || !selectedUserId || !newPlatform || !newHandle}
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
