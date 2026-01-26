import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, Shield, Clock } from 'lucide-react';
import type { InfluencerProfile } from '@/types/influencer';
import { SOCIAL_PLATFORMS } from '@/types/influencer';

interface InfluencerSettingsTabProps {
  profile: InfluencerProfile | null;
}

export const InfluencerSettingsTab: React.FC<InfluencerSettingsTabProps> = ({ profile }) => {
  if (!profile) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Profile not found.</p>
            <p className="text-sm">Please contact an administrator.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const permissions = [
    { key: 'can_post', label: 'Create Posts', value: profile.can_post },
    { key: 'can_schedule', label: 'Schedule Posts', value: profile.can_schedule },
    { key: 'can_manage_accounts', label: 'Manage Accounts', value: profile.can_manage_accounts },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Your influencer profile and permissions</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Your influencer profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Display Name</span>
              <span className="font-medium">{profile.display_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Bio</span>
              <span className="font-medium text-right max-w-[200px] truncate">
                {profile.bio || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              {profile.is_active ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
            <CardDescription>What you're allowed to do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permissions.map((perm) => (
              <div key={perm.key} className="flex justify-between items-center">
                <span className="text-muted-foreground">{perm.label}</span>
                {perm.value ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Platform Access */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Platform Access</CardTitle>
            <CardDescription>Social platforms you can post to</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const hasAccess = profile.platforms_access?.includes(platform.id);
                return (
                  <Badge
                    key={platform.id}
                    variant={hasAccess ? 'default' : 'outline'}
                    className={hasAccess ? '' : 'opacity-50'}
                    style={hasAccess ? { backgroundColor: platform.color } : {}}
                  >
                    {platform.name}
                    {hasAccess ? (
                      <CheckCircle className="h-3 w-3 ml-1" />
                    ) : (
                      <XCircle className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
