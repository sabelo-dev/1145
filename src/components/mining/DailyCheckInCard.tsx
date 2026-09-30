import { useEffect, useState } from 'react';
import { CalendarCheck, Flame, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { callRewardRpc } from '@/lib/ucRewards';

interface CheckInResult {
  success: boolean;
  already?: boolean;
  streak?: number;
  earned?: number;
  error?: string;
}

// South African calendar day, matching uc_daily_check_in().
const todaySA = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());

interface DailyCheckInCardProps {
  /** Called after UC is added, so wallets on the page can refresh. */
  onEarned?: () => void;
}

export function DailyCheckInCard({ onEarned }: DailyCheckInCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [streak, setStreak] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      // uc_checkins is not in the generated types yet.
      const { data } = await (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)('uc_checkins')
        .select('checkin_date, streak')
        .eq('user_id', user.id)
        .order('checkin_date', { ascending: false })
        .limit(2);
      if (!active) return;
      const rows = (data ?? []) as unknown as { checkin_date: string; streak: number }[];
      const today = todaySA();
      const yesterday = new Date(`${today}T12:00:00Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const y = yesterday.toISOString().slice(0, 10);
      const latest = rows[0];
      setCheckedInToday(latest?.checkin_date === today);
      // A streak is still alive if the last check-in was today or yesterday.
      setStreak(latest && (latest.checkin_date === today || latest.checkin_date === y) ? latest.streak : 0);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const checkIn = async () => {
    setSubmitting(true);
    try {
      const r = await callRewardRpc<CheckInResult>('uc_daily_check_in');
      if (!r.success) throw new Error(r.error || 'Check-in failed');
      setCheckedInToday(true);
      setStreak(r.streak ?? streak);
      if (!r.already) {
        const bonus = (r.streak ?? 0) % 30 === 0 ? ' 30-day streak bonus!' : (r.streak ?? 0) % 7 === 0 ? ' 7-day streak bonus!' : '';
        toast({ title: `+${r.earned} UC`, description: `Day ${r.streak} checked in.${bonus}` });
        onEarned?.();
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Check-in failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  // Position in the current 7-day cycle; a completed cycle shows as full.
  const inCycle = streak > 0 && streak % 7 === 0 ? 7 : streak % 7;
  const progress = (inCycle / 7) * 100;
  const toNext7 = 7 - inCycle;

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Daily check-in</p>
            <p className="text-sm text-muted-foreground">
              5 UC a day, 50 UC every 7 days in a row, 300 UC at 30 days.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={progress} className="h-2 flex-1" aria-label="Progress to the next 7-day bonus" />
              <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                {streak} day{streak === 1 ? '' : 's'}
                {streak > 0 && toNext7 > 0 ? ` · ${toNext7} to bonus` : ''}
              </span>
            </div>
          </div>
        </div>
        <Button onClick={checkIn} disabled={loading || submitting || checkedInToday} className="sm:w-40">
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {checkedInToday ? 'Checked in today' : 'Check in (+5 UC)'}
        </Button>
      </CardContent>
    </Card>
  );
}
