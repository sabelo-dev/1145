import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckCircle, XCircle, Shield, Loader2, Save, User, MapPin } from 'lucide-react';
import type { InfluencerProfile } from '@/types/influencer';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { useInfluencer } from '@/hooks/useInfluencer';

interface InfluencerSettingsTabProps {
  profile: InfluencerProfile | null;
}

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

export const InfluencerSettingsTab: React.FC<InfluencerSettingsTabProps> = ({ profile }) => {
  const { updateProfile } = useInfluencer();
  
  // Profile info
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  
  // Personal details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idNumber, setIdNumber] = useState('');
  
  // Address
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('South Africa');
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setDateOfBirth(profile.date_of_birth || '');
      setIdNumber(profile.id_number || '');
      setStreetAddress(profile.street_address || '');
      setCity(profile.city || '');
      setProvince(profile.province || '');
      setPostalCode(profile.postal_code || '');
      setCountry(profile.country || 'South Africa');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const changes = 
        displayName !== (profile.display_name || '') ||
        username !== (profile.username || '') ||
        bio !== (profile.bio || '') ||
        firstName !== (profile.first_name || '') ||
        lastName !== (profile.last_name || '') ||
        phone !== (profile.phone || '') ||
        dateOfBirth !== (profile.date_of_birth || '') ||
        idNumber !== (profile.id_number || '') ||
        streetAddress !== (profile.street_address || '') ||
        city !== (profile.city || '') ||
        province !== (profile.province || '') ||
        postalCode !== (profile.postal_code || '') ||
        country !== (profile.country || 'South Africa');
      setHasChanges(changes);
    }
  }, [displayName, username, bio, firstName, lastName, phone, dateOfBirth, idNumber, streetAddress, city, province, postalCode, country, profile]);

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
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      date_of_birth: dateOfBirth || undefined,
      id_number: idNumber.trim() || undefined,
      street_address: streetAddress.trim() || undefined,
      city: city.trim() || undefined,
      province: province || undefined,
      postal_code: postalCode.trim() || undefined,
      country: country || undefined,
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
          <p className="text-muted-foreground">Your influencer profile and personal details</p>
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
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Your public influencer profile</CardDescription>
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

        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Details
            </CardTitle>
            <CardDescription>Your legal information for admin records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+27 XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID / Passport Number</Label>
              <Input
                id="idNumber"
                placeholder="ID or passport number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Required for verification and payment purposes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
            <CardDescription>Your residential address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                placeholder="123 Main Street, Apt 4B"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {SA_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  placeholder="0001"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={100}
                />
              </div>
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
            
            <Separator className="my-4" />
            
            <div>
              <h4 className="font-medium mb-3">Platform Access</h4>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
