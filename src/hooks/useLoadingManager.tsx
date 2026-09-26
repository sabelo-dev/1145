import { useState, useRef, useCallback } from "react";

export interface LoadingManager {
  isLoading: boolean;
  /** Reads the live value; safe inside timers and async callbacks. */
  isBusy: () => boolean;
  startLoading: (operation: string) => void;
  stopLoading: (operation?: string) => void;
  operations: Set<string>;
}

/**
 * Tracks named in-flight operations. Pass `initialOperation` to start in the
 * loading state on the very first render (e.g. restoring an auth session), so
 * consumers never see a "not loading, no data" frame before work begins.
 */
export const useLoadingManager = (initialOperation?: string): LoadingManager => {
  const operationsRef = useRef<Set<string>>(new Set(initialOperation ? [initialOperation] : []));
  const [isLoading, setIsLoading] = useState(operationsRef.current.size > 0);

  const startLoading = useCallback((operation: string) => {
    operationsRef.current.add(operation);
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback((operation?: string) => {
    if (operation) {
      operationsRef.current.delete(operation);
    } else {
      operationsRef.current.clear();
    }

    if (operationsRef.current.size === 0) {
      setIsLoading(false);
    }
  }, []);

  const isBusy = useCallback(() => operationsRef.current.size > 0, []);

  return {
    isLoading,
    isBusy,
    startLoading,
    stopLoading,
    operations: operationsRef.current,
  };
};
