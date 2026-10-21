import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyStoreAccess, isNotInstalled, type StoreAccess } from "@/services/merchantAi";

const STORE_KEY = "1145.merchant-store";

// The chosen store is shared by every component on the page (the console's
// menu and each of its tabs), so switching store updates them all at once.
let selectedStoreId: string | null = (() => {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
})();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSelected = () => selectedStoreId;
const select = (id: string) => {
  if (id === selectedStoreId) return;
  selectedStoreId = id;
  try { localStorage.setItem(STORE_KEY, id); } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener());
};

/**
 * The stores the signed-in user can work in (as owner or staff), with their
 * permissions and the features switched on, plus the store currently chosen.
 * For showing and hiding things only; the database checks every action.
 */
export function useMerchantAccess() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["merchant-access", user?.id],
    queryFn: fetchMyStoreAccess,
    retry: (count, error) => !isNotInstalled(error) && count < 2,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const storeId = useSyncExternalStore(subscribe, getSelected, getSelected);
  const stores = query.data ?? [];
  const current: StoreAccess | undefined = stores.find((s) => s.store_id === storeId) ?? stores[0];

  // Remember the store actually shown (the first one when nothing was chosen yet).
  useEffect(() => {
    if (current && current.store_id !== storeId) select(current.store_id);
  }, [current, storeId]);

  const setStoreId = useCallback((id: string) => select(id), []);

  return { stores, current, setStoreId, isLoading: query.isLoading, error: query.error as Error | null };
}
