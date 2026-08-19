import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link2, ExternalLink, CheckCircle, Shield, Plus, Clock, Trash2, Zap, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';
import { AddAccountDialog } from './AddAccountDialog';
import { SocialOAuthConnect } from './SocialOAuthConnect';
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
  const [activeTab, setActiveTab] = useState('oauth');

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
      <div className="mb-4 min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold">My Social Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Connect and manage your social media accounts for content publishing
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="oauth" className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="truncate">API Connect</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Key className="h-4 w-4 shrink-0" />
            <span className="truncate">Manual</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oauth">
          <SocialOAuthConnect />
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <div className="header-row">
                <div className="header-content">
                  <CardTitle className="flex items-start gap-2 text-base sm:text-lg">
                    <Link2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>Manual Account Linking</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Add accounts manually for verification (no API access)
                  </CardDescription>
                </div>
                <div className="header-actions">
                  <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Add Account</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No manual accounts linked yet.</p>
                  <p className="text-sm mt-2">Use API Connect above for automatic posting, or add accounts manually here.</p>
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
                            <Badge variant="outline" className="text-gold border-gold">
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
        </TabsContent>
      </Tabs>

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
