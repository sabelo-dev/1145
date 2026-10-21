import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_KEY = "1145.order-console-sound";
const ALARM_MS = 30_000;
const REPEAT_MS = 1_500;

type AudioContextCtor = typeof AudioContext;
const AudioContextClass: AudioContextCtor | undefined = typeof window === "undefined"
  ? undefined
  : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

/** Three rising tones, loud enough to hear across a shop counter. */
function chime(context: AudioContext) {
  const tone = (frequency: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration);
  };
  const t = context.currentTime;
  tone(660, t, 0.18);
  tone(880, t + 0.22, 0.18);
  tone(1100, t + 0.44, 0.3);
}

/**
 * New-order alarm for the order console. Orders waiting to be accepted that
 * were not there before raise an alert: the console flashes, and while sound
 * is on a chime repeats for 30 seconds (with vibration where supported) until
 * someone accepts, silences or dismisses. Orders already waiting when the
 * console opens don't alarm. The tab title shows how many are waiting.
 *
 * Browsers only allow sound after a tap on the page; until then
 * `soundBlocked` is true and the console asks for a tap.
 */
export function useOrderAlarm(waitingIds: string[] | undefined) {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
  });
  const [alerting, setAlerting] = useState<string[]>([]);
  const [alarmUntil, setAlarmUntil] = useState(0);
  const [soundBlocked, setSoundBlocked] = useState(true);
  const seen = useRef<Set<string> | null>(null);
  const context = useRef<AudioContext | null>(null);

  /** Creates or resumes audio; must run inside a tap or click. */
  const unlockSound = useCallback(() => {
    if (!AudioContextClass) return;
    if (!context.current) context.current = new AudioContextClass();
    void context.current.resume().then(() => setSoundBlocked(context.current?.state !== "running"));
  }, []);

  // Any tap on the page unlocks sound for the rest of the session.
  useEffect(() => {
    const onTap = () => unlockSound();
    window.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onTap);
    return () => {
      window.removeEventListener("pointerdown", onTap);
      window.removeEventListener("keydown", onTap);
    };
  }, [unlockSound]);

  const key = waitingIds?.join(",");
  useEffect(() => {
    if (!waitingIds) return;
    if (seen.current === null) {
      seen.current = new Set(waitingIds);
      return;
    }
    const fresh = waitingIds.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    // Drop alerts for orders that are no longer waiting (accepted on another tablet).
    setAlerting((current) => {
      const still = current.filter((id) => waitingIds.includes(id));
      return fresh.length ? [...still, ...fresh] : still;
    });
    if (fresh.length) setAlarmUntil(Date.now() + ALARM_MS);
    // `key` stands in for the array's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The alarm itself: repeat the chime until it times out or there is nothing left to alert.
  const ringing = alerting.length > 0 && alarmUntil > Date.now();
  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      if (soundOn && context.current?.state === "running") chime(context.current);
      if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300]);
    };
    ring();
    const repeat = window.setInterval(ring, REPEAT_MS);
    const stop = window.setTimeout(() => setAlarmUntil(0), Math.max(alarmUntil - Date.now(), 0));
    return () => {
      window.clearInterval(repeat);
      window.clearTimeout(stop);
    };
  }, [ringing, alarmUntil, soundOn]);

  const waiting = waitingIds?.length ?? 0;
  useEffect(() => {
    if (waiting === 0) return;
    const original = document.title;
    document.title = `(${waiting}) New ${waiting === 1 ? "order" : "orders"} · ${original.replace(/^\(\d+\) New orders? · /, "")}`;
    return () => { document.title = original; };
  }, [waiting]);

  const toggleSound = useCallback(() => {
    unlockSound();
    setSoundOn((on) => {
      const next = !on;
      try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
      if (next && context.current) chime(context.current);
      return next;
    });
  }, [unlockSound]);

  /** Stops the sound but keeps the alert on screen. */
  const silence = useCallback(() => setAlarmUntil(0), []);
  /** Removes one order from the alert (accepted), or all of them (view later). */
  const dismiss = useCallback((orderId?: string) => {
    setAlerting((current) => (orderId ? current.filter((id) => id !== orderId) : []));
  }, []);

  return { alerting, ringing, soundOn, soundBlocked, toggleSound, unlockSound, silence, dismiss };
}
