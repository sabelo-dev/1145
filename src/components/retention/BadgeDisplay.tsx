import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Award, ShoppingBag, ShoppingCart, Zap, Crown, Flame, Trophy, Medal,
  Users, Heart, Star, MessageSquare, MapPin, Home, Coins, Gem, Diamond, Lock
} from 'lucide-react';
import { BadgeDefinition, ConsumerBadge } from '@/types/retention';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Award, ShoppingBag, ShoppingCart, Zap, Crown, Flame, Trophy, Medal,
  Users, Heart, Star, MessageSquare, MapPin, Home, Coins, Gem, Diamond
};

interface BadgeDisplayProps {
  earnedBadges: ConsumerBadge[];
  allBadges: BadgeDefinition[];
  showAll?: boolean;
  compact?: boolean;
}

export function BadgeDisplay({ earnedBadges, allBadges, showAll = false, compact = false }: BadgeDisplayProps) {
  const earnedIds = new Set(earnedBadges.map(b => b.badge_id));
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'loyalty': return 'from-amber-500 to-orange-500';
      case 'social': return 'from-pink-500 to-rose-500';
      case 'spending': return 'from-emerald-500 to-green-500';
      case 'special': return 'from-purple-500 to-indigo-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const renderBadge = (badge: BadgeDefinition, isEarned: boolean) => {
    const Icon = iconMap[badge.icon] || Award;
    const earnedBadge = earnedBadges.find(eb => eb.badge_id === badge.id);
    
    return (
      <TooltipProvider key={badge.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "relative flex flex-col items-center p-3 rounded-xl transition-all cursor-pointer",
                isEarned 
                  ? "bg-gradient-to-br opacity-100 hover:scale-105" 
                  : "bg-muted/50 opacity-50 grayscale hover:opacity-70",
                isEarned && getCategoryColor(badge.category)
              )}
            >
              <div className={cn(
                "p-2 rounded-full mb-2",
                isEarned ? "bg-white/20" : "bg-muted"
              )}>
                {isEarned ? (
                  <Icon className="h-6 w-6 text-white" />
                ) : (
                  <Lock className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium text-center line-clamp-2",
                isEarned ? "text-white" : "text-muted-foreground"
              )}>
                {badge.display_name}
              </span>
              {badge.ucoin_reward > 0 && isEarned && (
                <Badge variant="secondary" className="mt-1 text-xs bg-white/20 text-white border-0">
                  +{badge.ucoin_reward} UCoin
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{badge.display_name}</p>
              <p className="text-sm text-muted-foreground">{badge.description}</p>
              {isEarned && earnedBadge && (
                <p className="text-xs text-green-500">
                  Earned on {new Date(earnedBadge.earned_at).toLocaleDateString()}
                </p>
              )}
              {!isEarned && (
                <p className="text-xs text-amber-500">
                  Reward: {badge.ucoin_reward} UCoin
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (compact) {
    const recentBadges = earnedBadges.slice(0, 5);
    return (
      <div className="flex items-center gap-2">
        {recentBadges.map(eb => {
          const badge = allBadges.find(b => b.id === eb.badge_id);
          if (!badge) return null;
          const Icon = iconMap[badge.icon] || Award;
          return (
            <TooltipProvider key={eb.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "p-2 rounded-full bg-gradient-to-br",
                    getCategoryColor(badge.category)
                  )}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{badge.display_name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
        {earnedBadges.length > 5 && (
          <Badge variant="secondary">+{earnedBadges.length - 5}</Badge>
        )}
      </div>
    );
  }

  const groupedBadges = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) acc[badge.category] = [];
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, BadgeDefinition[]>);

  const categoryLabels: Record<string, string> = {
    loyalty: '🎯 Loyalty',
    social: '👥 Social',
    spending: '💰 Spending',
    special: '⭐ Special'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Your Badges
          </span>
          <Badge variant="secondary">
            {earnedBadges.length} / {allBadges.length}
          </Badge>
        </CardTitle>
        <Progress 
          value={(earnedBadges.length / allBadges.length) * 100} 
          className="h-2"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedBadges).map(([category, badges]) => {
          const displayBadges = showAll ? badges : badges.filter(b => earnedIds.has(b.id));
          if (!showAll && displayBadges.length === 0) return null;
          
          return (
            <div key={category}>
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">
                {categoryLabels[category] || category}
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {(showAll ? badges : displayBadges).map(badge => 
                  renderBadge(badge, earnedIds.has(badge.id))
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
