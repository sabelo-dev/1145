import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link2, ExternalLink, CheckCircle, Shield, Plus, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';
import { AddAccountDialog } from './AddAccountDialog';
import { toast } from 'sonner';
import DeleteConfirmDialog from '@/components/admin/cms/DeleteConfirmDialog';

interface UserAccount {
  id: string;
  platform: string;
  account_handle: string;
  account_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  added_by_admin?: string;
}

export const InfluencerAccountsTab: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching accounts:', error);
        throw error;
      }
      
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

  const handleDeleteClick = (account: UserAccount) => {
    // Only allow deleting user-added accounts (not admin-added)
    if (account.added_by_admin) {
      toast.error('Admin-assigned accounts cannot be removed. Contact an administrator.');
      return;
    }
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('approved_social_accounts')
        .delete()
        .eq('id', accountToDelete.id);

      if (error) throw error;

      toast.success(`Account @${accountToDelete.account_handle} removed`);
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to remove account');
    } finally {
      setIsDeleting(false);
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
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold">My Social Accounts</h2>
          <p className="text-muted-foreground">
            Manage your connected social media accounts
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Your linked social accounts for content creation and management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No social accounts connected yet.</p>
              <p className="text-sm mt-2">Click "Connect Account" to add your social media profiles.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell>{getPlatformBadge(account.platform)}</TableCell>
                    <TableCell className="font-medium">@{account.account_handle}</TableCell>
                    <TableCell>
                      {account.is_verified && account.is_active ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : account.is_active ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.added_by_admin ? (
                        <Badge variant="secondary">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Self</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(account.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                        {!account.added_by_admin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(account)}
                            title="Remove account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddAccountDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchAccounts}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remove Account"
        description={`Are you sure you want to remove @${accountToDelete?.account_handle}? You can add it again later.`}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </>
  );
};

