import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  Navigation,
  DollarSign,
  Clock,
  Package,
  Zap,
  X,
  Check,
  AlertTriangle,
  Route,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { JobOffer } from "@/services/matchingEngine";

interface JobOfferModalProps {
  offer: JobOffer | null;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onExpire: (offerId: string) => void;
}

const JobOfferModal: React.FC<JobOfferModalProps> = ({
  offer,
  onAccept,
  onDecline,
  onExpire,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!offer) return;

    const expiresAt = new Date(offer.expires_at).getTime();
    const offeredAt = new Date(offer.offered_at).getTime();
    const total = (expiresAt - offeredAt) / 1000;
    setTotalTime(total);

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, (expiresAt - now) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) onExpire(offer.id);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [offer, onExpire]);

  const handleAccept = useCallback(async () => {
    if (!offer) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from("delivery_jobs")
        .update({ driver_id: offer.driver_id, status: "accepted" })
        .eq("id", offer.job.id)
        .eq("status", "pending")
        .is("driver_id", null);

      if (error) {
        toast({ variant: "destructive", title: "Job Already Taken", description: "This job was claimed by another driver." });
      } else {
        toast({ title: "Job Accepted!", description: "Head to the pickup location now." });
        onAccept(offer.id);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to accept job. Please try again." });
    }

    setIsProcessing(false);
  }, [offer, onAccept, toast]);

  const handleDecline = useCallback(() => {
    if (!offer) return;
    onDecline(offer.id);
  }, [offer, onDecline]);

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  const progressPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isUrgent = timeLeft < 10;

  if (!offer) return null;

  return (
    <Dialog open={!!offer} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-6 pt-6 pb-8 text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary-foreground)/0.1),transparent_70%)]" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2.5 text-primary-foreground text-lg">
              <div className="p-2 rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
                <Package className="h-5 w-5" />
              </div>
              New Delivery Request
            </DialogTitle>
          </DialogHeader>

          {/* Earnings hero */}
          <div className="relative mt-5 text-center">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-sm opacity-80">R</span>
              <span className="text-5xl font-black tracking-tight">
                {offer.earnings.toFixed(2)}
              </span>
            </div>
            {offer.surge_multiplier > 1 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 backdrop-blur-sm px-3 py-1">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs font-semibold text-amber-200">
                  {offer.surge_multiplier}x surge active
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 -mt-3 space-y-5">
          {/* Timer card */}
          <div className={`rounded-xl border p-3.5 transition-colors ${isUrgent ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-2.5">
              <span className={`text-xs font-medium flex items-center gap-1.5 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
                {isUrgent && <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />}
                Time remaining
              </span>
              <span className={`text-lg font-mono font-black tabular-nums ${isUrgent ? "text-destructive animate-pulse" : "text-foreground"}`}>
                {Math.ceil(timeLeft)}s
              </span>
            </div>
            <Progress
              value={progressPercent}
              className={`h-1.5 ${isUrgent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          </div>

          {/* Route */}
          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-[23px] top-[44px] bottom-[44px] w-px border-l-2 border-dashed border-muted-foreground/25" />

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="relative z-10 p-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                  <p className="font-medium text-sm truncate">{formatAddress(offer.job.pickup_address)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="relative z-10 p-2 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <Navigation className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Drop-off</p>
                  <p className="font-medium text-sm truncate">{formatAddress(offer.job.delivery_address)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {offer.job.distance_km && (
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                <Route className="h-3 w-3 mr-1.5" />
                {offer.job.distance_km.toFixed(1)} km
              </Badge>
            )}
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
              <Clock className="h-3 w-3 mr-1.5" />
              ~{Math.round((offer.job.distance_km || 5) * 3)} min
            </Badge>
            {offer.job.priority === "urgent" && (
              <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs font-semibold animate-pulse">
                Urgent
              </Badge>
            )}
          </div>

          {offer.job.time_window_end && (
            <p className="text-center text-xs text-muted-foreground">
              Deliver by{" "}
              <span className="font-semibold text-foreground">
                {new Date(offer.job.time_window_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl text-sm font-semibold"
              onClick={handleDecline}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25"
              onClick={handleAccept}
              disabled={isProcessing}
            >
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? "Accepting..." : "Accept Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobOfferModal;
