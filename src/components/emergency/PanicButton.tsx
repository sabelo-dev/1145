import React, { useState, useRef, useCallback, useEffect } from "react";
import { Phone } from "lucide-react";
import { emergencyService } from "@/services/emergencyService";
import { trackingService } from "@/services/trackingService";
import { useToast } from "@/hooks/use-toast";
import EmergencyConfirmation from "./EmergencyConfirmation";

interface PanicButtonProps {
  userId: string;
  role: "driver" | "rider";
  tripId?: string;
  silentMode?: boolean;
  className?: string;
}

const HOLD_DURATION_MS = 2000;
const CANCEL_GRACE_SECONDS = 5;

const PanicButton: React.FC<PanicButtonProps> = ({
  userId,
  role,
  tripId,
  silentMode = false,
  className = "",
}) => {
  const { toast } = useToast();
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cancelCountdown, setCancelCountdown] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    };
  }, []);

  const startHold = useCallback(() => {
    if (eventId || confirmed) return;
    setHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(progress);
    }, 30);

    holdTimerRef.current = setTimeout(() => {
      if (progressRef.current) clearInterval(progressRef.current);
      setHoldProgress(100);
      triggerPanic();
    }, HOLD_DURATION_MS);
  }, [eventId, confirmed]);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setHolding(false);
    setHoldProgress(0);
  }, []);

  const triggerPanic = async () => {
    setHolding(false);

    // Vibrate if available and not silent
    if (!silentMode && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    const pos = await trackingService.getCurrentPosition();
    const event = await emergencyService.createEmergencyEvent({
      user_id: userId,
      role,
      trip_id: tripId,
      lat: pos?.lat,
      lng: pos?.lng,
      silent_mode: silentMode,
    });

    if (event) {
      setEventId(event.id);
      setCancelCountdown(CANCEL_GRACE_SECONDS);

      // Start cancel countdown
      let remaining = CANCEL_GRACE_SECONDS;
      cancelTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCancelCountdown(remaining);
        if (remaining <= 0) {
          if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
          setCancelCountdown(null);
          setConfirmed(true);
        }
      }, 1000);
    } else {
      toast({
        title: "Alert Failed",
        description: "Please call emergency services directly at 10111",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    if (cancelTimerRef.current) clearInterval(cancelTimerRef.current);
    setCancelCountdown(null);

    if (eventId) {
      await emergencyService.cancelEmergencyEvent(eventId, "False alarm");
      setEventId(null);
      toast({
        title: "Emergency Cancelled",
        description: "Your alert has been cancelled.",
      });
    }
  };

  const handleDismissConfirmation = () => {
    setConfirmed(false);
    setEventId(null);
  };

  // Confirmed state — show help screen
  if (confirmed && eventId) {
    return (
      <EmergencyConfirmation
        eventId={eventId}
        onDismiss={handleDismissConfirmation}
      />
    );
  }

  // Cancel countdown state
  if (cancelCountdown !== null && eventId) {
    return (
      <div className={`fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center ${className}`}>
        <div className="text-center space-y-6 p-8">
          <div className="text-6xl">🆘</div>
          <h2 className="text-2xl font-bold text-white">Emergency Alert Sent</h2>
          <p className="text-white/80 text-lg">
            Cancel within <span className="text-destructive font-bold text-3xl">{cancelCountdown}</span> seconds
          </p>
          <button
            onClick={handleCancel}
            className="px-8 py-4 bg-white text-black rounded-full text-lg font-bold hover:bg-white/90 transition-colors"
          >
            Cancel Alert (False Alarm)
          </button>
          <p className="text-white/50 text-sm mt-4">
            For immediate help, call <strong>10111</strong> (SAPS)
          </p>
        </div>
      </div>
    );
  }

  // Default — panic button
  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        className="relative w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-all active:scale-95 select-none touch-none"
        aria-label="Hold for emergency"
      >
        {/* Progress ring */}
        {holding && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 64 64"
          >
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray={`${holdProgress * 1.885} 188.5`}
              className="transition-none"
            />
          </svg>
        )}
        <Phone className="h-6 w-6" />
      </button>
      {holding && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-destructive font-medium whitespace-nowrap">
          Hold to trigger SOS...
        </span>
      )}
    </div>
  );
};

export default PanicButton;
