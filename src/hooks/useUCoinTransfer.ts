import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UCoinTransferLimits, UCoinUserSettings, UCoinTransfer, TransferResult } from '@/types/ucoin';
import { useToast } from '@/hooks/use-toast';

export function useUCoinTransfer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [limits, setLimits] = useState<UCoinTransferLimits | null>(null);
  const [settings, setSettings] = useState<UCoinUserSettings | null>(null);
  const [transfers, setTransfers] = useState<UCoinTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchLimits = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc('get_user_transfer_limits', {
      p_user_id: user.id
    });

    if (!error && data && data.length > 0) {
      setLimits(data[0] as UCoinTransferLimits);
    }
  }, [user]);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ucoin_user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      setSettings(data as UCoinUserSettings);
    } else {
      // Create default settings
      const { data: newSettings } = await supabase
        .from('ucoin_user_settings')
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (newSettings) {
        setSettings(newSettings as UCoinUserSettings);
      }
    }
  }, [user]);

  const fetchTransfers = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc('get_ucoin_transfers', {
      p_user_id: user.id,
      p_limit: 50
    });

    if (!error && data) {
      setTransfers(data as UCoinTransfer[]);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLimits(), fetchSettings(), fetchTransfers()]);
      setIsLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchLimits, fetchSettings, fetchTransfers]);

  const transfer = async (
    recipientId: string,
    amount: number,
    note?: string
  ): Promise<TransferResult> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    setIsTransferring(true);

    try {
      const { data, error } = await supabase.rpc('transfer_ucoin', {
        p_sender_id: user.id,
        p_recipient_identifier: recipientId,
        p_amount_mg: amount,
        p_note: note || null,
        p_ip_address: null,
        p_device_fingerprint: null
      });

      if (error) {
        toast({
          title: 'Transfer Failed',
          description: error.message,
          variant: 'destructive'
        });
        return { success: false, error: error.message };
      }

      const result = data as unknown as TransferResult;

      if (result && result.success) {
        toast({
          title: 'Transfer Successful!',
          description: `Sent ${amount} UCoin (${amount} mg Au). Ref: ${result.transfer_reference}`
        });
        
        // Refresh data
        await Promise.all([fetchLimits(), fetchTransfers()]);
      } else {
        toast({
          title: 'Transfer Failed',
          description: result.error || 'Unknown error',
          variant: 'destructive'
        });
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Transfer failed';
      toast({
        title: 'Transfer Failed',
        description: errorMsg,
        variant: 'destructive'
      });
      return { success: false, error: errorMsg };
    } finally {
      setIsTransferring(false);
    }
  };

  const updateSettings = async (updates: Partial<UCoinUserSettings>) => {
    if (!user) return false;

    const { error } = await supabase
      .from('ucoin_user_settings')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive'
      });
      return false;
    }

    await fetchSettings();
    return true;
  };

  // Convert UCoin to rand display
  const formatAsRand = (ucoin: number): string => {
    const randValue = ucoin * 0.10; // 1 UCoin = R0.10
    return `R${randValue.toFixed(2)}`;
  };

  return {
    limits,
    settings,
    transfers,
    isLoading,
    isTransferring,
    transfer,
    updateSettings,
    formatAsRand,
    refreshLimits: fetchLimits,
    refreshTransfers: fetchTransfers
  };
}
