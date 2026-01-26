import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, ExternalLink, Shield, ShieldOff } from 'lucide-react';
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
  user_name?: string;
  user_email?: string;
}

export const ApprovedAccountsManager: React.FC = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ApprovedAccount[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchAccounts();
  }, []);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Approved Social Accounts
        </CardTitle>
        <CardDescription>
          Manage verified social media accounts that can be used for task verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No social accounts pending approval.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Status</TableHead>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
