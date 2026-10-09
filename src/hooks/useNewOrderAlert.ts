import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_KEY = "1145.eatery-order-sound";

/** Two short rising tones. Browsers only allow sound after the user has interacted with the page. */
const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const tone = (frequency: number, start: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      oscillator.start(start);
      oscillator.stop(start + duration);
    };
    tone(660, context.currentTime, 0.18);
    tone(880, context.currentTime + 0.2, 0.28);
    setTimeout(() => void context.close(), 1000);
  } catch {
    // sound is a nicety; never let it break the dashboard
  }
};

/**
 * Watches the ids of orders waiting to be accepted. When a new one arrives after the
 * first load it calls `onNew` and (if sound is on) plays a chime. While any are waiting,
 * the browser tab title shows the count so it is noticed from another tab.
 */
export function useNewOrderAlert(waitingIds: string[] | undefined, onNew: (count: number) => void) {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
  });
  const seen = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
      if (next) playChime(); // confirms it works, and counts as the interaction browsers require
      return next;
    });
  }, []);

  const key = waitingIds?.join(",");
  useEffect(() => {
    if (!waitingIds) return;
    if (seen.current === null) {
      // First load: these were already waiting, so they are not "new".
      seen.current = new Set(waitingIds);
      return;
    }
    const fresh = waitingIds.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    if (fresh.length > 0) {
      onNewRef.current(fresh.length);
      if (soundOn) playChime();
    }
    // `key` stands in for the array's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, soundOn]);

  const waiting = waitingIds?.length ?? 0;
  useEffect(() => {
    if (waiting === 0) return;
    const original = document.title;
    document.title = `(${waiting}) New ${waiting === 1 ? "order" : "orders"} · ${original.replace(/^\(\d+\) New orders? · /, "")}`;
    return () => { document.title = original; };
  }, [waiting]);

  return { soundOn, toggleSound };
}
