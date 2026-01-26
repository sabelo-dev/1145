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
import { Plus, Link2, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';

interface UserAccount {
  id: string;
  platform: string;
  account_handle: string;
  account_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export const InfluencerAccountsTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data as UserAccount[] || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const handleAddAccount = async () => {
    if (!user || !newPlatform || !newHandle) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('approved_social_accounts')
        .insert({
          user_id: user.id,
          platform: newPlatform,
          account_handle: newHandle,
          account_url: newUrl || null,
        });

      if (error) throw error;

      toast({
        title: 'Account Added',
        description: 'Your social account has been submitted for approval.',
      });

      setIsAddDialogOpen(false);
      setNewPlatform('');
      setNewHandle('');
      setNewUrl('');
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
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">My Social Accounts</h2>
          <p className="text-muted-foreground">Manage your connected social media accounts</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Accounts must be approved by an admin before they can be used for task verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No social accounts connected yet.</p>
              <p className="text-sm">Add your social media accounts to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Handle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{getPlatformBadge(account.platform)}</TableCell>
                    <TableCell className="font-medium">@{account.account_handle}</TableCell>
                    <TableCell>
                      {account.is_verified ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Approval
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(account.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      {account.account_url && (
                        <a
                          href={account.account_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
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
            <DialogTitle>Add Social Account</DialogTitle>
            <DialogDescription>
              Connect a social media account for content management
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                placeholder="@yourusername"
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
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAccount}
              disabled={isSubmitting || !newPlatform || !newHandle}
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
