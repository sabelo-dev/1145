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
import { Link2, ExternalLink, CheckCircle, XCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { format } from 'date-fns';

interface ConnectedAccount {
  id: string;
  user_id: string;
  platform: string;
  account_handle: string;
  account_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  added_by_admin?: string;
  user_name?: string;
  user_email?: string;
}

export const ConnectedAccountsList: React.FC = () => {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // First fetch approved accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('approved_social_accounts')
          .select('*')
          .order('created_at', { ascending: false });

        if (accountsError) {
          console.error('Error fetching accounts:', accountsError);
          throw accountsError;
        }

        if (!accountsData || accountsData.length === 0) {
          setAccounts([]);
          setLoading(false);
          return;
        }

        // Get unique user IDs for profile lookup
        const userIds = [...new Set(accountsData.map(acc => acc.user_id))];
        
        // Fetch profiles separately
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

        // Merge account data with profile data
        const formattedAccounts = accountsData.map((acc: any) => ({
          ...acc,
          user_name: profileMap.get(acc.user_id)?.name || 'Unknown',
          user_email: profileMap.get(acc.user_id)?.email || '',
        }));

        setAccounts(formattedAccounts);
      } catch (error) {
        console.error('Error fetching accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

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

  const getAccountStats = () => {
    const total = accounts.length;
    const verified = accounts.filter((a) => a.is_verified).length;
    const adminAdded = accounts.filter((a) => a.added_by_admin).length;
    const platformCounts = accounts.reduce((acc, account) => {
      acc[account.platform] = (acc[account.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, verified, adminAdded, platformCounts };
  };

  const stats = getAccountStats();

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
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Accounts</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Verified</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.verified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Admin Added</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.adminAdded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">By Platform</span>
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(stats.platformCounts).map(([platform, count]) => (
                <Badge key={platform} variant="secondary" className="text-xs">
                  {platform}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            All Connected Accounts
          </CardTitle>
          <CardDescription>
            Social media accounts connected across all users and influencers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No connected accounts yet</p>
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
                  <TableHead>Connected</TableHead>
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
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <XCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {!account.is_active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.added_by_admin ? (
                        <Badge variant="secondary">Admin</Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(account.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
