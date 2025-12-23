import { useCountdown } from "@/hooks/useCountdown";
import { Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuctionCountdownProps {
  targetDate: string | null;
  type: "start" | "end";
  className?: string;
  compact?: boolean;
  onExpire?: () => void;
}

const AuctionCountdown = ({ targetDate, type, className, compact = false, onExpire }: AuctionCountdownProps) => {
  const { days, hours, minutes, seconds, isExpired, formatted } = useCountdown(targetDate, { onExpire });

  if (!targetDate) return null;

  if (isExpired) {
    return (
      <div className={cn("flex items-center gap-1 text-sm", className)}>
        <Clock className="h-4 w-4" />
        <span>{type === "start" ? "Started" : "Ended"}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1 text-sm", className)}>
        <Timer className="h-4 w-4 animate-pulse" />
        <span className="font-mono font-medium">{formatted}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Timer className="h-4 w-4" />
        <span>{type === "start" ? "Starts in" : "Ends in"}</span>
      </div>
      <div className="flex gap-1">
        {days > 0 && (
          <div className="bg-primary/10 rounded px-2 py-1 text-center min-w-[40px]">
            <div className="text-lg font-bold font-mono">{days}</div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        )}
        <div className="bg-primary/10 rounded px-2 py-1 text-center min-w-[40px]">
          <div className="text-lg font-bold font-mono">{hours.toString().padStart(2, "0")}</div>
          <div className="text-xs text-muted-foreground">hrs</div>
        </div>
        <div className="bg-primary/10 rounded px-2 py-1 text-center min-w-[40px]">
          <div className="text-lg font-bold font-mono">{minutes.toString().padStart(2, "0")}</div>
          <div className="text-xs text-muted-foreground">min</div>
        </div>
        <div className="bg-primary/10 rounded px-2 py-1 text-center min-w-[40px]">
          <div className="text-lg font-bold font-mono animate-pulse">{seconds.toString().padStart(2, "0")}</div>
          <div className="text-xs text-muted-foreground">sec</div>
        </div>
      </div>
    </div>
  );
};

export default AuctionCountdown;
