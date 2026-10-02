import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAppUrl } from '@/lib/appUrl';
import { toast } from 'sonner';

/**
 * Instagram never makes caption links clickable, so product posts there say
 * "link in my bio" (see social-publish). This is the link to put in the bio.
 */
export const BioLinkCard: React.FC = () => {
  const { user } = useAuth();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.rpc('get_or_create_referral_code', { p_user_id: user.id }).then(({ data, error }) => {
      if (error) console.error('Error loading referral code:', error);
      else if (!cancelled && typeof data === 'string') setCode(data);
    });
    return () => { cancelled = true; };
  }, [user]);

  if (!code) return null;

  const link = getAppUrl(`/shop?ref=${encodeURIComponent(code)}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Bio link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-base sm:text-lg">
          <Link2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>Your bio link</span>
        </CardTitle>
        <CardDescription className="mt-1">
          Instagram doesn't make links in captions clickable, so your product posts there say "Shop via the link in my bio".
          Add this link to your Instagram profile so followers can tap through with your referral code {code}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={link} aria-label="Your bio link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
        <Button onClick={copy} className="gap-2 shrink-0">
          <Copy className="h-4 w-4 shrink-0" />
          <span>Copy link</span>
        </Button>
      </CardContent>
    </Card>
  );
};
