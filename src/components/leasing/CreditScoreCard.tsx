import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { creditScoringEngine, type CreditScore } from "@/services/leasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Shield, TrendingUp, Wallet, Truck, Car, Clock, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CreditScoreCardProps {
  compact?: boolean;
  onScoreLoaded?: (score: CreditScore) => void;
}

const CreditScoreCard: React.FC<CreditScoreCardProps> = ({ compact, onScoreLoaded }) => {
  const { user } = useAuth();
  const [score, setScore] = useState<CreditScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    creditScoringEngine.getCachedScore(user.id).then(s => {
      if (s) { setScore(s); onScoreLoaded?.(s); }
      setLoading(false);
    });
  }, [user?.id]);

  const handleCalculate = async () => {
    if (!user?.id) return;
    setCalculating(true);
    try {
      const result = await creditScoringEngine.calculateScore(user.id);
      setScore(result);
      onScoreLoaded?.(result);
    } catch (e) { console.error(e); }
    setCalculating(false);
  };

  if (loading) return <Skeleton className="h-48 rounded-xl" />;

  if (!score) {
    return (
      <Card className="border-0 ring-1 ring-border">
        <CardContent className="py-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Credit Score Not Available</h3>
          <p className="text-sm text-muted-foreground mb-4">Calculate your 1145 behavioral credit score to unlock lease options.</p>
          <Button onClick={handleCalculate} disabled={calculating}>
            {calculating && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Calculate My Score
          </Button>
        </CardContent>
      </Card>
    );
  }

  const riskDisplay = creditScoringEngine.getRiskDisplay(score.risk_level);
  const grade = creditScoringEngine.getScoreGrade(score.score);
  const scoreColor = creditScoringEngine.getScoreColor(score.score);
  const pct = Math.round((score.score / 850) * 100);

  if (compact) {
    return (
      <Card className="border-0 ring-1 ring-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="relative h-16 w-16">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct}, 100`} className={scoreColor} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor}`}>{score.score}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{grade}</p>
            <Badge className={`${riskDisplay.bg} ${riskDisplay.text} border-0 mt-1`}>{riskDisplay.label}</Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Max Lease</p>
            <p className="font-bold">{formatCurrency(score.max_lease_value)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const factors = [
    { label: 'Orders', icon: ShoppingBag, score: score.factors?.order_history?.score || 0, max: 200, detail: `${score.factors?.order_history?.count || 0} completed` },
    { label: 'Wallet', icon: Wallet, score: score.factors?.wallet?.score || 0, max: 150, detail: formatCurrency(score.factors?.wallet?.balance || 0) },
    { label: 'Deliveries', icon: Truck, score: score.factors?.delivery?.score || 0, max: 150, detail: `${score.factors?.delivery?.count || 0} trips` },
    { label: 'Rides', icon: Car, score: score.factors?.rides?.score || 0, max: 100, detail: `${score.factors?.rides?.count || 0} rides` },
    { label: 'Payments', icon: TrendingUp, score: score.factors?.payments?.score || 0, max: 100, detail: `${score.factors?.payments?.late_count || 0} late` },
    { label: 'Tenure', icon: Clock, score: score.factors?.tenure?.score || 0, max: 100, detail: `${score.factors?.tenure?.days || 0} days` },
  ];

  return (
    <Card className="border-0 ring-1 ring-border overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" />1145 Credit Score</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleCalculate} disabled={calculating}>
            <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${pct}, 100`} className={scoreColor} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black ${scoreColor}`}>{score.score}</span>
              <span className="text-[10px] text-muted-foreground">/850</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xl font-bold">{grade}</p>
            <Badge className={`${riskDisplay.bg} ${riskDisplay.text} border-0 mt-1`}>{riskDisplay.label}</Badge>
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">Max Lease Value: </span>
              <span className="font-bold">{formatCurrency(score.max_lease_value)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Score Breakdown</p>
          {factors.map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span>{f.label}</span>
                  <span className="text-muted-foreground">{f.detail}</span>
                </div>
                <Progress value={f.max > 0 ? (f.score / f.max) * 100 : 0} className="h-1.5" />
              </div>
              <span className="text-xs font-mono w-8 text-right">{f.score}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditScoreCard;
