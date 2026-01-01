import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Flame, Trophy, Calendar, TrendingUp } from 'lucide-react';
import { ConsumerStreak } from '@/types/retention';

interface StreakCardProps {
  streak: ConsumerStreak | null;
  compact?: boolean;
}

export function StreakCard({ streak, compact = false }: StreakCardProps) {
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalWeeks = streak?.total_weeks_ordered || 0;
  
  // Streak milestones for rewards
  const nextMilestone = currentStreak < 3 ? 3 : currentStreak < 8 ? 8 : 12;
  const progress = (currentStreak / nextMilestone) * 100;
  
  const getStreakEmoji = () => {
    if (currentStreak >= 12) return '🔥🔥🔥';
    if (currentStreak >= 8) return '🔥🔥';
    if (currentStreak >= 3) return '🔥';
    return '✨';
  };

  const getStreakReward = () => {
    if (nextMilestone === 3) return '30 UCoin';
    if (nextMilestone === 8) return '100 UCoin';
    return '250 UCoin';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
        <div className="p-2 rounded-full bg-orange-500/20">
          <Flame className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{currentStreak}</span>
            <span className="text-sm text-muted-foreground">week streak</span>
            <span>{getStreakEmoji()}</span>
          </div>
          <Progress value={progress} className="h-1.5 mt-1" />
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Order Streak
          {currentStreak >= 3 && (
            <Badge className="ml-auto bg-orange-500 text-white">
              {getStreakEmoji()} Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Current Streak Display */}
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-orange-500 mb-1">
            {currentStreak}
          </div>
          <div className="text-muted-foreground">weeks in a row</div>
        </div>

        {/* Progress to Next Milestone */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress to {nextMilestone}-week streak</span>
            <span className="text-orange-500 font-medium">{getStreakReward()}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentStreak} weeks</span>
            <span>{nextMilestone} weeks</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Trophy className="h-4 w-4 mx-auto mb-1 text-amber-500" />
            <div className="font-bold">{longestStreak}</div>
            <div className="text-xs text-muted-foreground">Best Streak</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <div className="font-bold">{totalWeeks}</div>
            <div className="text-xs text-muted-foreground">Total Weeks</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <div className="font-bold">{Math.round((totalWeeks / 52) * 100)}%</div>
            <div className="text-xs text-muted-foreground">Yearly</div>
          </div>
        </div>

        {/* Motivation Message */}
        <div className="text-center text-sm text-muted-foreground pt-2 border-t">
          {currentStreak === 0 && "Place an order to start your streak!"}
          {currentStreak > 0 && currentStreak < 3 && `${3 - currentStreak} more week${3 - currentStreak > 1 ? 's' : ''} to earn 30 UCoin!`}
          {currentStreak >= 3 && currentStreak < 8 && `You're on fire! ${8 - currentStreak} more for 100 UCoin!`}
          {currentStreak >= 8 && currentStreak < 12 && `Almost legendary! ${12 - currentStreak} more for 250 UCoin!`}
          {currentStreak >= 12 && "🎉 You're a streak legend! Keep it going!"}
        </div>
      </CardContent>
    </Card>
  );
}
