import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  DriverTier,
  DriverTierHistory,
  DeliveryEarnings,
  DriverCashout,
  DriverInvestment,
  DriverVehicleFund,
  DriverPerformanceStats,
  DriverRetentionData,
} from '@/types/driver';
import { useToast } from '@/hooks/use-toast';

export function useDriverRetention() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [data, setData] = useState<DriverRetentionData>({
    tier: null,
    allTiers: [],
    tierHistory: [],
    earnings: [],
    cashouts: [],
    investments: [],
    vehicleFund: null,
    performanceStats: [],
    pendingTips: 0,
    availableBalance: 0,
    totalEarnings: 0,
  });

  // Fetch driver ID
  useEffect(() => {
    async function fetchDriverId() {
      if (!user) return;
      
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, available_balance, total_earnings, tier_id')
        .eq('user_id', user.id)
        .single();
      
      if (driver) {
        setDriverId(driver.id);
        setData(prev => ({
          ...prev,
          availableBalance: driver.available_balance || 0,
          totalEarnings: driver.total_earnings || 0,
        }));
      }
    }
    fetchDriverId();
  }, [user]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!driverId) return;
    
    setLoading(true);
    try {
      // Fetch all tiers
      const { data: tiers } = await supabase
        .from('driver_tiers')
        .select('*')
        .order('level', { ascending: true });

      // Fetch driver's current tier
      const { data: driver } = await supabase
        .from('drivers')
        .select('tier_id, available_balance, total_earnings')
        .eq('id', driverId)
        .single();

      let currentTier: DriverTier | null = null;
      if (driver?.tier_id && tiers) {
        currentTier = tiers.find(t => t.id === driver.tier_id) as DriverTier | null;
      }

      // Fetch tier history
      const { data: tierHistory } = await supabase
        .from('driver_tier_history')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent earnings
      const { data: earnings } = await supabase
        .from('delivery_earnings')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch cashouts
      const { data: cashouts } = await supabase
        .from('driver_cashouts')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch investments
      const { data: investments } = await supabase
        .from('driver_investments')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      // Fetch vehicle fund
      const { data: vehicleFund } = await supabase
        .from('driver_vehicle_fund')
        .select('*')
        .eq('driver_id', driverId)
        .single();

      // Fetch performance stats
      const { data: performanceStats } = await supabase
        .from('driver_performance_stats')
        .select('*')
        .eq('driver_id', driverId)
        .order('period_start', { ascending: false })
        .limit(12);

      // Fetch pending tips
      const { data: tips } = await supabase
        .from('delivery_tips')
        .select('amount')
        .eq('driver_id', driverId)
        .eq('status', 'pending');

      const pendingTips = tips?.reduce((sum, t) => sum + t.amount, 0) || 0;

      setData({
        tier: currentTier,
        allTiers: (tiers as DriverTier[]) || [],
        tierHistory: (tierHistory as DriverTierHistory[]) || [],
        earnings: (earnings as DeliveryEarnings[]) || [],
        cashouts: (cashouts as DriverCashout[]) || [],
        investments: (investments as DriverInvestment[]) || [],
        vehicleFund: vehicleFund as DriverVehicleFund | null,
        performanceStats: (performanceStats as DriverPerformanceStats[]) || [],
        pendingTips,
        availableBalance: driver?.available_balance || 0,
        totalEarnings: driver?.total_earnings || 0,
      });
    } catch (error) {
      console.error('Error fetching driver retention data:', error);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Request cashout
  const requestCashout = async (amount: number, paymentMethod: string) => {
    if (!driverId || !data.tier) return false;

    const feePercent = data.tier.cashout_fee_percent;
    const feeAmount = (amount * feePercent) / 100;
    const netAmount = amount - feeAmount;

    if (amount > data.availableBalance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: 'You do not have enough balance for this cashout.',
      });
      return false;
    }

    const { error } = await supabase.from('driver_cashouts').insert({
      driver_id: driverId,
      amount,
      fee_amount: feeAmount,
      fee_percent: feePercent,
      net_amount: netAmount,
      payment_method: paymentMethod,
      status: 'pending',
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Cashout Failed',
        description: error.message,
      });
      return false;
    }

    // Update driver balance
    await supabase
      .from('drivers')
      .update({ available_balance: data.availableBalance - amount })
      .eq('id', driverId);

    toast({
      title: 'Cashout Requested',
      description: `R${netAmount.toFixed(2)} will be transferred to your account.`,
    });

    fetchData();
    return true;
  };

  // Create investment
  const createInvestment = async (
    investmentType: 'brand_stake' | 'vehicle_savings' | 'storefront_fund',
    amount: number,
    ucoinAmount: number = 0,
    targetVendorId?: string
  ) => {
    if (!driverId) return false;

    const { error } = await supabase.from('driver_investments').insert({
      driver_id: driverId,
      investment_type: investmentType,
      amount,
      ucoin_spent: ucoinAmount,
      target_vendor_id: targetVendorId || null,
      status: 'active',
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Investment Failed',
        description: error.message,
      });
      return false;
    }

    toast({
      title: 'Investment Created',
      description: 'Your investment has been successfully created.',
    });

    fetchData();
    return true;
  };

  // Update vehicle fund
  const contributeToVehicleFund = async (amount: number, ucoinAmount: number = 0) => {
    if (!driverId) return false;

    if (data.vehicleFund) {
      const { error } = await supabase
        .from('driver_vehicle_fund')
        .update({
          total_saved: data.vehicleFund.total_saved + amount,
          ucoin_contributed: data.vehicleFund.ucoin_contributed + ucoinAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.vehicleFund.id);

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Contribution Failed',
          description: error.message,
        });
        return false;
      }
    } else {
      const { error } = await supabase.from('driver_vehicle_fund').insert({
        driver_id: driverId,
        total_saved: amount,
        ucoin_contributed: ucoinAmount,
        status: 'saving',
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Contribution Failed',
          description: error.message,
        });
        return false;
      }
    }

    toast({
      title: 'Contribution Added',
      description: `R${amount.toFixed(2)} added to your vehicle fund.`,
    });

    fetchData();
    return true;
  };

  // Get next tier progress
  const getNextTierProgress = () => {
    if (!data.tier || !data.allTiers.length) return null;

    const currentLevel = data.tier.level;
    const nextTier = data.allTiers.find(t => t.level === currentLevel + 1);
    
    if (!nextTier) return null;

    // This would need actual driver stats - for now return placeholder
    return {
      nextTier,
      progress: {
        deliveries: { current: 0, required: nextTier.min_deliveries },
        ontime_rate: { current: 0, required: nextTier.min_ontime_rate },
        acceptance_rate: { current: 0, required: nextTier.min_acceptance_rate },
        rating: { current: 0, required: nextTier.min_rating },
      },
    };
  };

  return {
    loading,
    data,
    driverId,
    requestCashout,
    createInvestment,
    contributeToVehicleFund,
    getNextTierProgress,
    refresh: fetchData,
  };
}
