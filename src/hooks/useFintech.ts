import { useCallback, useEffect, useState } from "react";
import { fintech, type WalletBundle } from "@/services/fintech";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useFintech() {
  const { user } = useAuth();
  const [data, setData] = useState<WalletBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const bundle = await fintech.loadWallet();
      setData(bundle);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Realtime: reload on ledger, card, bank, withdrawal changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`fintech-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_ledger", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_instruments", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "linked_bank_accounts", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { data, loading, error, reload: load };
}
