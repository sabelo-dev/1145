import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, Crown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getAppUrl } from '@/lib/appUrl';
import { ucToRand } from '@/lib/ucRewards';

interface Tier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  min_conversions: number;
  monthly_price: number;
  daily_mining_cap: number;
  monthly_mining_cap: number | null;
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: string | null;
  tier_id: string;
}

// uc_tier_subscriptions / new tier columns are not in the generated types yet.
const from = (table: string) => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(table);

/** Tier table with PayFast upgrade / cancel. A tier is reached by qualified
 *  referrals or by paying monthly, whichever is higher. */
export function TierPlans({ currentLevel, qualifiedReferrals }: { currentLevel: number; qualifiedReferrals: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await from('affiliate_tiers').select('*').order('level');
    setTiers((data ?? []) as unknown as Tier[]);
    if (user) {
      const { data: s } = await from('uc_tier_subscriptions')
        .select('id, status, current_period_end, tier_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'cancelled'])
        .gt('current_period_end', new Date().toISOString())
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSub((s as unknown as Subscription) ?? null);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Back from PayFast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('tier_payment');
    if (!status) return;
    toast(status === 'success'
      ? { title: 'Payment received', description: 'Your tier updates as soon as PayFast confirms the payment (usually within a minute).' }
      : { variant: 'destructive', title: 'Payment cancelled', description: 'Your tier was not changed.' });
    params.delete('tier_payment');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [toast]);

  const upgrade = async (tier: Tier) => {
    setBusy(tier.id);
    try {
      const here = window.location.pathname + window.location.search;
      const sep = here.includes('?') ? '&' : '?';
      const { data, error } = await supabase.functions.invoke('payfast-payment', {
        body: {
          customStr1: tier.name,
          customStr2: 'tier_subscription',
          returnUrl: getAppUrl(`${here}${sep}tier_payment=success`),
          cancelUrl: getAppUrl(`${here}${sep}tier_payment=cancelled`),
        },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }
      if (!data?.success || !data.formData) throw new Error(data?.error || 'Could not start the payment');

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action;
      Object.entries(data.formData as Record<string, string>).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Upgrade failed', description: e instanceof Error ? e.message : String(e) });
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      const { data, error } = await supabase.functions.invoke('tier-subscription', { body: { action: 'cancel' } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Could not cancel');
      toast({
        title: 'Subscription cancelled',
        description: data.active_until ? `You keep your tier until ${format(new Date(data.active_until), 'd MMM yyyy')}.` : undefined,
      });
      await load();
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const paidTier = sub ? tiers.find((t) => t.id === sub.tier_id) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5" /> Tiers</CardTitle>
        <CardDescription>
          Reach a tier with qualified referrals ({qualifiedReferrals} so far), or subscribe to get it now.
          Your tier is whichever is higher.
        </CardDescription>
        {sub && paidTier && sub.current_period_end && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-sm">
            <Badge variant="secondary">{paidTier.display_name} subscription</Badge>
            <span className="text-muted-foreground">
              {sub.status === 'cancelled' ? 'Cancelled, active until' : 'Renews'} {format(new Date(sub.current_period_end), 'd MMM yyyy')}
            </span>
            {sub.status === 'active' && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={cancel} disabled={busy === 'cancel'}>
                {busy === 'cancel' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Cancel subscription
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Qualified referrals</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Monthly price</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Max UC/day</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Max UC/30 days</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Value/month</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => {
                const current = t.level === currentLevel;
                const monthly = t.monthly_mining_cap ?? t.daily_mining_cap * 30;
                const canBuy = Number(t.monthly_price) > 0 && t.level > currentLevel;
                return (
                  <tr key={t.id} className={`border-t ${current ? 'bg-primary/5' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {t.display_name}
                      {current && <Check className="inline h-4 w-4 ml-1 text-green-600" aria-label="Your tier" />}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{t.min_conversions}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {Number(t.monthly_price) > 0 ? `R${Number(t.monthly_price).toLocaleString()}` : 'Free'}
                    </td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{t.daily_mining_cap.toLocaleString()} UC</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{monthly.toLocaleString()} UC</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{ucToRand(monthly).replace('.00', '')}</td>
                    <td className="px-3 py-2 text-right">
                      {canBuy && (
                        <Button size="sm" onClick={() => upgrade(t)} disabled={!!busy}>
                          {busy === t.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Get {t.display_name}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Subscriptions bill monthly through PayFast and can be cancelled any time; you keep the tier until the paid month ends.
        </p>
      </CardContent>
    </Card>
  );
}
