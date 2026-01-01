import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, TrendingUp, Package, Megaphone, Truck, HeadphonesIcon,
  X, ArrowRight, AlertTriangle, Info, CheckCircle
} from 'lucide-react';
import { BrandImprovementTip } from '@/types/brand';
import { cn } from '@/lib/utils';

interface ImprovementTipsProps {
  tips: BrandImprovementTip[];
  onDismiss: (tipId: string) => void;
  onMarkRead: (tipId: string) => void;
}

const tipIcons: Record<string, React.ElementType> = {
  pricing: TrendingUp,
  inventory: Package,
  marketing: Megaphone,
  fulfillment: Truck,
  customer_service: HeadphonesIcon
};

const priorityConfig = {
  low: { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Info },
  medium: { color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Lightbulb },
  high: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: AlertTriangle },
  urgent: { color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', icon: AlertTriangle }
};

export function ImprovementTips({ tips, onDismiss, onMarkRead }: ImprovementTipsProps) {
  if (tips.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="font-medium text-lg">You're doing great!</h3>
          <p className="text-muted-foreground">No improvement suggestions right now.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedTips = [...tips].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          What to Improve Next
        </CardTitle>
        <CardDescription>
          AI-powered suggestions to grow your business
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedTips.map((tip) => {
          const TypeIcon = tipIcons[tip.tip_type] || Lightbulb;
          const config = priorityConfig[tip.priority];
          const PriorityIcon = config.icon;
          
          return (
            <div 
              key={tip.id}
              className={cn(
                "relative p-4 rounded-lg border transition-all",
                !tip.is_read && "ring-2 ring-primary/20"
              )}
              onClick={() => !tip.is_read && onMarkRead(tip.id)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(tip.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-start gap-4">
                <div className={cn("p-2 rounded-lg", config.bg)}>
                  <TypeIcon className={cn("h-5 w-5", config.color)} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs capitalize", config.color)}
                    >
                      <PriorityIcon className="h-3 w-3 mr-1" />
                      {tip.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {tip.tip_type.replace(/_/g, ' ')}
                    </Badge>
                    {!tip.is_read && (
                      <Badge className="text-xs bg-primary">New</Badge>
                    )}
                  </div>
                  
                  <h4 className="font-medium mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                  
                  {tip.action_url && (
                    <Button variant="link" className="p-0 h-auto mt-2 text-sm" asChild>
                      <a href={tip.action_url}>
                        Take action <ArrowRight className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
