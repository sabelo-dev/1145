import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link2, ExternalLink, CheckCircle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  added_by_admin?: string;
}

export const InfluencerAccountsTab: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      // Fetch all accounts assigned to this user (whether added by admin or self)
      const { data, error } = await supabase
        .from('approved_social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching accounts:', error);
        throw error;
      }
      
      console.log('Fetched influencer accounts:', data);
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
      <div className="mb-4">
        <h2 className="text-2xl font-bold">My Social Accounts</h2>
        <p className="text-muted-foreground">
          Social accounts assigned to you by the platform administrator
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            These accounts have been verified and assigned by an administrator for content management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No social accounts assigned yet.</p>
              <p className="text-sm">Contact an administrator to have accounts assigned to your profile.</p>
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
                      {account.is_verified && account.is_active ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
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
    </>
  );
};
