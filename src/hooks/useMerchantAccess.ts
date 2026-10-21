import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyStoreAccess, isNotInstalled, type StoreAccess } from "@/services/merchantAi";

const STORE_KEY = "1145.merchant-store";

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

  const [storeId, setStoreIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORE_KEY); } catch { return null; }
  });

  const stores = query.data ?? [];
  const current: StoreAccess | undefined = stores.find((s) => s.store_id === storeId) ?? stores[0];

  useEffect(() => {
    if (current && current.store_id !== storeId) setStoreIdState(current.store_id);
  }, [current, storeId]);

  const setStoreId = useCallback((id: string) => {
    setStoreIdState(id);
    try { localStorage.setItem(STORE_KEY, id); } catch { /* storage unavailable */ }
  }, []);

  return { stores, current, setStoreId, isLoading: query.isLoading, error: query.error as Error | null };
}
