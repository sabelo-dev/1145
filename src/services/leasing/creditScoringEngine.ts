import { supabase } from "@/integrations/supabase/client";

export interface CreditScore {
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'very_high' | 'unknown';
  max_lease_value: number;
  factors: {
    order_history: { count: number; total: number; score: number };
    wallet: { balance: number; score: number };
    delivery: { count: number; ontime_rate: number; score: number };
    rides: { count: number; score: number };
    payments: { late_count: number; score: number };
    tenure: { days: number; score: number };
  };
  last_calculated_at?: string;
}

const RISK_COLORS = {
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Low Risk' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Medium Risk' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'High Risk' },
  very_high: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Very High Risk' },
  unknown: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Not Scored' },
};

export const creditScoringEngine = {
  async calculateScore(userId: string): Promise<CreditScore> {
    const { data, error } = await supabase.rpc('calculate_lease_credit_score', { p_user_id: userId });
    if (error) throw error;
    const result = data as any;
    return {
      score: result.score,
      risk_level: result.risk_level,
      max_lease_value: result.max_lease_value,
      factors: result.factors,
    };
  },

  async getCachedScore(userId: string): Promise<CreditScore | null> {
    const { data } = await supabase
      .from('lease_credit_scores')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return null;
    return {
      score: data.overall_score,
      risk_level: data.risk_level as CreditScore['risk_level'],
      max_lease_value: Number(data.max_lease_value),
      factors: (data.factors as any) || {},
      last_calculated_at: data.last_calculated_at || undefined,
    };
  },

  getRiskDisplay(risk: CreditScore['risk_level']) {
    return RISK_COLORS[risk] || RISK_COLORS.unknown;
  },

  getScoreGrade(score: number): string {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 500) return 'Fair';
    if (score >= 300) return 'Poor';
    return 'Very Poor';
  },

  getScoreColor(score: number): string {
    if (score >= 750) return 'text-emerald-500';
    if (score >= 650) return 'text-primary';
    if (score >= 500) return 'text-amber-500';
    if (score >= 300) return 'text-orange-500';
    return 'text-destructive';
  },

  canAffordLease(score: CreditScore, monthlyPayment: number, leaseDuration: number): boolean {
    const totalValue = monthlyPayment * leaseDuration;
    return totalValue <= score.max_lease_value && score.risk_level !== 'very_high';
  },
};
