import { useState, useEffect, useRef, useCallback } from "react";

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string;
}

interface UseCountdownOptions {
  onExpire?: () => void;
}

export const useCountdown = (
  targetDate: Date | string | null,
  options?: UseCountdownOptions
): CountdownResult => {
  const [timeLeft, setTimeLeft] = useState<CountdownResult>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
    formatted: "00:00:00",
  });
  
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(options?.onExpire);
  
  // Keep the callback ref updated
  onExpireRef.current = options?.onExpire;

  useEffect(() => {
    // Reset expired flag when target date changes
    hasExpiredRef.current = false;
    
    if (!targetDate) {
      setTimeLeft({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        formatted: "00:00:00",
      });
      return;
    }

    const calculateTimeLeft = () => {
      const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
      const now = new Date();
      const difference = target.getTime() - now.getTime();

      if (difference <= 0) {
        // Only trigger onExpire once per target date
        if (!hasExpiredRef.current && onExpireRef.current) {
          hasExpiredRef.current = true;
          // Use setTimeout to avoid calling during render
          setTimeout(() => onExpireRef.current?.(), 0);
        }
        
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          formatted: "00:00:00",
        };
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const pad = (n: number) => n.toString().padStart(2, "0");
      
      let formatted = "";
      if (days > 0) {
        formatted = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      } else {
        formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }

      return {
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        formatted,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
};
