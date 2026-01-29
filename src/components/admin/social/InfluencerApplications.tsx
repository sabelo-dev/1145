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
import { UserPlus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface InfluencerApplication {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  applied_at: string;
  social_accounts: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface InfluencerApplicationsProps {
  onApproved?: () => void;
}

export const InfluencerApplications: React.FC<InfluencerApplicationsProps> = ({ onApproved }) => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<InfluencerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      // Get users who have added social accounts but are not yet influencers
      // This serves as an implicit "application" system
      const { data: accountsWithUsers, error } = await supabase
        .from('approved_social_accounts')
        .select(`
          user_id,
          created_at,
          profiles:user_id (id, name, email, role)
        `)
        .is('added_by_admin', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get existing influencer profiles
      const { data: existingInfluencers } = await supabase
        .from('influencer_profiles')
        .select('user_id');

      const influencerUserIds = new Set(existingInfluencers?.map((i) => i.user_id) || []);

      // Group by user and filter out existing influencers
      const userMap = new Map<string, InfluencerApplication>();

      (accountsWithUsers || []).forEach((acc: any) => {
        if (acc.profiles && !influencerUserIds.has(acc.user_id)) {
          if (!userMap.has(acc.user_id)) {
            userMap.set(acc.user_id, {
              id: acc.user_id,
              user_id: acc.user_id,
              user_name: acc.profiles.name || 'Unknown',
              user_email: acc.profiles.email,
              applied_at: acc.created_at,
              social_accounts: 1,
              status: 'pending',
            });
          } else {
            const existing = userMap.get(acc.user_id)!;
            existing.social_accounts += 1;
          }
        }
      });

      setApplications(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleApprove = async (application: InfluencerApplication) => {
    setProcessing(application.id);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Create influencer profile
      const { error: profileError } = await supabase
        .from('influencer_profiles')
        .insert({
          user_id: application.user_id,
          display_name: application.user_name,
          assigned_by: currentUser?.id,
        });

      if (profileError) throw profileError;

      // Remove consumer role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', application.user_id)
        .eq('role', 'consumer');

      // Add influencer role
      await supabase
        .from('user_roles')
        .insert({
          user_id: application.user_id,
          role: 'influencer',
        });

      // Update profiles table
      await supabase
        .from('profiles')
        .update({ role: 'influencer' })
        .eq('id', application.user_id);

      // Verify and approve their social accounts
      await supabase
        .from('approved_social_accounts')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: currentUser?.id,
        })
        .eq('user_id', application.user_id);

      toast({
        title: 'Application Approved',
        description: `${application.user_name} has been approved as an influencer.`,
      });

      fetchApplications();
      onApproved?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to approve application',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (application: InfluencerApplication) => {
    if (!window.confirm(`Are you sure you want to reject ${application.user_name}'s application?`)) {
      return;
    }

    setProcessing(application.id);

    try {
      // Remove their pending social accounts
      await supabase
        .from('approved_social_accounts')
        .delete()
        .eq('user_id', application.user_id)
        .is('added_by_admin', null);

      toast({
        title: 'Application Rejected',
        description: 'The application has been rejected and social accounts removed.',
      });

      fetchApplications();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reject application',
      });
    } finally {
      setProcessing(null);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Influencer Applications
        </CardTitle>
        <CardDescription>
          Users who have added social accounts and are awaiting influencer approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending applications</p>
            <p className="text-sm">Users will appear here when they add social accounts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Social Accounts</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{app.user_name}</div>
                      <div className="text-xs text-muted-foreground">{app.user_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{app.social_accounts} account(s)</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(app.applied_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(app)}
                        disabled={processing === app.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(app)}
                        disabled={processing === app.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
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
