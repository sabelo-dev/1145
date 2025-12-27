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

      if (remaining <= 0) {
        onExpire(offer.id);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [offer, onExpire]);

  const handleAccept = async () => {
    if (!offer) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from("delivery_jobs")
        .update({
          driver_id: offer.driver_id,
          status: "accepted",
        })
        .eq("id", offer.job.id)
        .eq("status", "pending")
        .is("driver_id", null);

      if (error) {
        toast({
          variant: "destructive",
          title: "Job Already Taken",
          description: "This job was claimed by another driver.",
        });
      } else {
        toast({
          title: "Job Accepted!",
          description: "Head to the pickup location now.",
        });
        onAccept(offer.id);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to accept job. Please try again.",
      });
    }

    setIsProcessing(false);
  };

  const handleDecline = () => {
    if (!offer) return;
    onDecline(offer.id);
  };

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
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            New Delivery Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={isUrgent ? "text-destructive font-medium" : "text-muted-foreground"}>
                {isUrgent && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                Time to respond
              </span>
              <span className={`font-mono font-bold ${isUrgent ? "text-destructive" : ""}`}>
                {Math.ceil(timeLeft)}s
              </span>
            </div>
            <Progress 
              value={progressPercent} 
              className={`h-2 ${isUrgent ? "[&>div]:bg-destructive" : ""}`}
            />
          </div>

          {/* Earnings */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="text-3xl font-bold text-green-600">
                R{offer.earnings.toFixed(2)}
              </span>
            </div>
            {offer.surge_multiplier > 1 && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-600 font-medium">
                  {offer.surge_multiplier}x surge pricing active
                </span>
              </div>
            )}
          </div>

          {/* Addresses */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">PICKUP</p>
                <p className="font-medium truncate">{formatAddress(offer.job.pickup_address)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Navigation className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">DELIVER TO</p>
                <p className="font-medium truncate">{formatAddress(offer.job.delivery_address)}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-2 justify-center">
            {offer.job.distance_km && (
              <Badge variant="outline">
                {offer.job.distance_km.toFixed(1)} km
              </Badge>
            )}
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              ~{Math.round((offer.job.distance_km || 5) * 3)} min
            </Badge>
            {offer.job.priority === "urgent" && (
              <Badge variant="destructive">Urgent</Badge>
            )}
          </div>

          {/* Time Window */}
          {offer.job.time_window_end && (
            <div className="text-center text-sm text-muted-foreground">
              Deliver by {new Date(offer.job.time_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDecline}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
              disabled={isProcessing}
            >
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? "Accepting..." : "Accept"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobOfferModal;
