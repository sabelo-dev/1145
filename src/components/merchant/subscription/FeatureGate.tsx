import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  isLocked: boolean;
  featureName: string;
  onUpgrade?: () => void;
  children: React.ReactNode;
  className?: string;
  showOverlay?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const FeatureGate: React.FC<FeatureGateProps> = ({
  isLocked,
  featureName,
  onUpgrade,
  children,
  className,
  showOverlay = true,
  tooltipSide = 'top',
}) => {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('relative', className)}>
            <div className={cn(showOverlay && 'opacity-50 pointer-events-none')}>
              {children}
            </div>
            {showOverlay && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <div className="text-center p-4">
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-2">Premium Feature</p>
                  {onUpgrade && (
                    <Button size="sm" onClick={onUpgrade} className="gap-1">
                      <Crown className="h-3 w-3" />
                      Upgrade
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <p><strong>{featureName}</strong> is a Premium feature.</p>
          <p className="text-xs text-muted-foreground">Upgrade to unlock this feature.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FeatureGate;
