import React from 'react';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number | null;
  unit?: string;
  showPercentage?: boolean;
  className?: string;
  onLimitReached?: () => void;
}

const UsageMeter: React.FC<UsageMeterProps> = ({
  label,
  current,
  limit,
  unit = '',
  showPercentage = true,
  className,
  onLimitReached,
}) => {
  // Unlimited
  if (limit === null) {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="flex items-center gap-1 text-primary font-medium">
            <CheckCircle className="h-4 w-4" />
            Unlimited
          </span>
        </div>
        <Progress value={0} className="h-2 bg-primary/20" />
      </div>
    );
  }

  const percentage = Math.min(Math.round((current / limit) * 100), 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const getStatusColor = () => {
    if (isAtLimit) return 'text-destructive';
    if (isNearLimit) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-destructive';
    if (isNearLimit) return 'bg-warning';
    return '';
  };

  const getIcon = () => {
    if (isAtLimit) return <XCircle className="h-4 w-4" />;
    if (isNearLimit) return <AlertTriangle className="h-4 w-4" />;
    return null;
  };

  React.useEffect(() => {
    if (isAtLimit && onLimitReached) {
      onLimitReached();
    }
  }, [isAtLimit, onLimitReached]);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('flex items-center gap-1 font-medium', getStatusColor())}>
          {getIcon()}
          {current}{unit} / {limit}{unit}
          {showPercentage && <span className="text-xs">({percentage}%)</span>}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={cn('h-2', getProgressColor())} 
      />
    </div>
  );
};

export default UsageMeter;
