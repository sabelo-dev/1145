import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_PLATFORMS } from '@/types/influencer';
import { toast } from 'sonner';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [platform, setPlatform] = useState('');
  const [handle, setHandle] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !platform || !handle.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate handle length
    if (handle.trim().length > 100) {
      toast.error('Handle must be less than 100 characters');
      return;
    }

    // Validate URL if provided
    if (profileUrl && profileUrl.length > 500) {
      toast.error('Profile URL must be less than 500 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if account already exists for this user
      const { data: existing } = await supabase
        .from('approved_social_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', platform)
        .eq('account_handle', handle.trim().replace('@', ''))
        .single();

      if (existing) {
        toast.error('This account is already connected');
        return;
      }

      const { error } = await supabase
        .from('approved_social_accounts')
        .insert({
          user_id: user.id,
          platform,
          account_handle: handle.trim().replace('@', ''),
          account_url: profileUrl.trim() || null,
          is_verified: false, // User-added accounts need admin verification
          is_active: true,
        });

      if (error) throw error;

      toast.success('Account added successfully! It will be verified by an administrator.');
      setPlatform('');
      setHandle('');
      setProfileUrl('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding account:', error);
      toast.error('Failed to add account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Connect Social Account</DialogTitle>
            <DialogDescription>
              Add your personal social media account. It will need to be verified by an administrator before it can be used for content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform *</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span style={{ color: p.color }}>{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="handle">Username / Handle *</Label>
              <Input
                id="handle"
                placeholder="@username"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profileUrl">Profile URL (optional)</Label>
              <Input
                id="profileUrl"
                type="url"
                placeholder="https://instagram.com/username"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !platform || !handle.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
