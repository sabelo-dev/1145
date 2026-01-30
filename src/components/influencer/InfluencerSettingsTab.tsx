import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Settings, CheckCircle, XCircle, Shield, Loader2, Save } from 'lucide-react';
import type { InfluencerProfile } from '@/types/influencer';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { useInfluencer } from '@/hooks/useInfluencer';

interface InfluencerSettingsTabProps {
  profile: InfluencerProfile | null;
}

export const InfluencerSettingsTab: React.FC<InfluencerSettingsTabProps> = ({ profile }) => {
  const { updateProfile } = useInfluencer();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const nameChanged = displayName !== (profile.display_name || '');
      const usernameChanged = username !== (profile.username || '');
      const bioChanged = bio !== (profile.bio || '');
      setHasChanges(nameChanged || usernameChanged || bioChanged);
    }
  }, [displayName, username, bio, profile]);

  const validateUsername = (value: string) => {
    if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and dashes');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    if (!validateUsername(username)) return;
    
    setIsSaving(true);
    const success = await updateProfile({
      display_name: displayName.trim() || undefined,
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
    });
    setIsSaving(false);
    if (success) {
      setHasChanges(false);
    }
  };

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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Your influencer profile and permissions</p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Editable Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your influencer profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your public name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                This name will be shown on posts you create
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="username"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    validateUsername(e.target.value);
                  }}
                  className="pl-7"
                  maxLength={50}
                />
              </div>
              {usernameError ? (
                <p className="text-xs text-destructive">{usernameError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This will be your unique tag across the platform
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {bio.length}/500 characters
              </p>
            </div>
            <div className="flex justify-between items-center pt-2">
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
