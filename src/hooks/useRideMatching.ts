import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rideMatchingService } from "@/services/rideMatchingService";
import { useToast } from "@/hooks/use-toast";

interface UseRideMatchingOptions {
  rideId: string | null;
  enabled?: boolean;
}

export function useRideMatching({ rideId, enabled = true }: UseRideMatchingOptions) {
  const [isSearching, setIsSearching] = useState(false);
  const [driversFound, setDriversFound] = useState(0);
  const [driversNotified, setDriversNotified] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [driverAssigned, setDriverAssigned] = useState(false);
  const [noDriversAvailable, setNoDriversAvailable] = useState(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const startMatching = useCallback(async () => {
    if (!rideId) return;

    setIsSearching(true);
    setNoDriversAvailable(false);
    setAttempt(0);

    const result = await rideMatchingService.matchRideToDrivers(rideId);

    setDriversFound(result.driversFound);
    setDriversNotified(result.driversNotified);

    if (result.status === "no_drivers") {
      toast({
        title: "All drivers are currently busy",
        description: "We're still searching. Please wait...",
      });
      // Start retry cycle
      scheduleRetry(rideId, 1);
    } else if (result.driversNotified > 0) {
      toast({
        title: `${result.driversNotified} driver${result.driversNotified > 1 ? "s" : ""} notified`,
        description: "Waiting for a driver to accept your ride...",
      });
      // Still schedule retries in case no one accepts
      scheduleRetry(rideId, 1);
    }
  }, [rideId, toast]);

  const scheduleRetry = useCallback(
    (id: string, nextAttempt: number) => {
      clearRetryTimer();
      // Retry every 15 seconds
      retryTimerRef.current = setTimeout(async () => {
        // Check if ride still needs a driver
        const { data: ride } = await supabase
          .from("rides")
          .select("status, driver_id")
          .eq("id", id)
          .single();

        if (!ride || ride.driver_id || ["cancelled", "completed", "no_drivers"].includes(ride.status)) {
          if (ride?.driver_id) setDriverAssigned(true);
          if (ride?.status === "no_drivers") setNoDriversAvailable(true);
          setIsSearching(false);
          return;
        }

        setAttempt(nextAttempt);

        const result = await rideMatchingService.retryMatch(id, nextAttempt);
        setDriversFound(result.driversFound);
        setDriversNotified(result.driversNotified);

        if (result.driversFound === 0 && nextAttempt >= 2) {
          toast({
            title: "Drivers are busy in your area",
            description: `Still searching (attempt ${nextAttempt}/5)...`,
          });
        } else if (result.driversNotified > 0) {
          toast({
            title: `${result.driversNotified} more driver${result.driversNotified > 1 ? "s" : ""} notified`,
            description: "Expanding search area...",
          });
        }

        if (result.shouldRetry) {
          scheduleRetry(id, nextAttempt + 1);
        } else if (!result.shouldRetry && result.driversFound === 0) {
          setNoDriversAvailable(true);
          setIsSearching(false);
          toast({
            variant: "destructive",
            title: "No drivers available",
            description: "Please try again in a few minutes.",
          });
        }
      }, 15000);
    },
    [clearRetryTimer, toast]
  );

  // Listen for ride updates (driver acceptance)
  useEffect(() => {
    if (!rideId || !enabled) return;

    const channel = supabase
      .channel(`ride-matching-${rideId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.driver_id) {
            setDriverAssigned(true);
            setIsSearching(false);
            clearRetryTimer();
            toast({
              title: "🎉 Driver found!",
              description: "A driver has accepted your ride request.",
            });
          }
          if (updated.status === "no_drivers") {
            setNoDriversAvailable(true);
            setIsSearching(false);
            clearRetryTimer();
          }
          if (updated.status === "cancelled") {
            setIsSearching(false);
            clearRetryTimer();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearRetryTimer();
    };
  }, [rideId, enabled, clearRetryTimer, toast]);

  // Auto-start matching when rideId is set
  useEffect(() => {
    if (rideId && enabled && !driverAssigned) {
      startMatching();
    }
    return () => clearRetryTimer();
  }, [rideId, enabled]);

  const retrySearch = useCallback(async () => {
    if (!rideId) return;
    setNoDriversAvailable(false);

    // Reset status to searching
    await supabase
      .from("rides")
      .update({ status: "searching", updated_at: new Date().toISOString() })
      .eq("id", rideId);

    startMatching();
  }, [rideId, startMatching]);

  return {
    isSearching,
    driversFound,
    driversNotified,
    attempt,
    driverAssigned,
    noDriversAvailable,
    retrySearch,
  };
}
