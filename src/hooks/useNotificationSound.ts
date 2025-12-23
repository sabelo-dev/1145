import { useCallback, useRef } from 'react';

// Create a simple notification sound using Web Audio API
const createNotificationSound = (type: 'outbid' | 'newBid' | 'win') => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (frequency: number, duration: number, startTime: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };
  
  const currentTime = audioContext.currentTime;
  
  switch (type) {
    case 'outbid':
      // Descending tones for outbid (alert)
      playTone(800, 0.15, currentTime);
      playTone(600, 0.15, currentTime + 0.15);
      playTone(400, 0.2, currentTime + 0.3);
      break;
    case 'newBid':
      // Single ping for new bid
      playTone(880, 0.1, currentTime);
      break;
    case 'win':
      // Ascending happy tones for win
      playTone(523, 0.15, currentTime);
      playTone(659, 0.15, currentTime + 0.15);
      playTone(784, 0.15, currentTime + 0.3);
      playTone(1047, 0.3, currentTime + 0.45);
      break;
  }
};

export const useNotificationSound = () => {
  const lastPlayedRef = useRef<number>(0);
  
  const playSound = useCallback((type: 'outbid' | 'newBid' | 'win') => {
    // Prevent playing sounds too rapidly (debounce 500ms)
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;
    
    try {
      createNotificationSound(type);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);
  
  return { playSound };
};
