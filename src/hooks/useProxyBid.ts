import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProxyBid {
  id: string;
  auction_id: string;
  user_id: string;
  max_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useProxyBid = (auctionId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's proxy bid for a specific auction
  const { data: proxyBid, isLoading } = useQuery({
    queryKey: ['proxy-bid', auctionId, user?.id],
    queryFn: async () => {
      if (!user?.id || !auctionId) return null;
      
      const { data, error } = await supabase
        .from('proxy_bids')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProxyBid | null;
    },
    enabled: !!user?.id && !!auctionId,
  });

  // Fetch all user's proxy bids
  const { data: allProxyBids } = useQuery({
    queryKey: ['proxy-bids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('proxy_bids')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProxyBid[];
    },
    enabled: !!user?.id,
  });

  // Set or update proxy bid
  const setProxyBidMutation = useMutation({
    mutationFn: async ({ auctionId, maxAmount }: { auctionId: string; maxAmount: number }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('proxy_bids')
        .upsert({
          auction_id: auctionId,
          user_id: user.id,
          max_amount: maxAmount,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'auction_id,user_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-bid'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-bids'] });
      toast({
        title: 'Auto-bid set',
        description: 'Your maximum bid has been saved. We\'ll automatically bid for you.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set auto-bid',
        variant: 'destructive',
      });
    },
  });

  // Cancel proxy bid
  const cancelProxyBidMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { error } = await supabase
        .from('proxy_bids')
        .delete()
        .eq('auction_id', auctionId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-bid'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-bids'] });
      toast({
        title: 'Auto-bid cancelled',
        description: 'Your automatic bidding has been stopped.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel auto-bid',
        variant: 'destructive',
      });
    },
  });

  // Toggle proxy bid active status
  const toggleProxyBidMutation = useMutation({
    mutationFn: async ({ auctionId, isActive }: { auctionId: string; isActive: boolean }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { error } = await supabase
        .from('proxy_bids')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('auction_id', auctionId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['proxy-bid'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-bids'] });
      toast({
        title: isActive ? 'Auto-bid activated' : 'Auto-bid paused',
        description: isActive 
          ? 'Automatic bidding is now active.' 
          : 'Automatic bidding has been paused.',
      });
    },
  });

  const setProxyBid = useCallback((auctionId: string, maxAmount: number) => {
    setProxyBidMutation.mutate({ auctionId, maxAmount });
  }, [setProxyBidMutation]);

  const cancelProxyBid = useCallback((auctionId: string) => {
    cancelProxyBidMutation.mutate(auctionId);
  }, [cancelProxyBidMutation]);

  const toggleProxyBid = useCallback((auctionId: string, isActive: boolean) => {
    toggleProxyBidMutation.mutate({ auctionId, isActive });
  }, [toggleProxyBidMutation]);

  return {
    proxyBid,
    allProxyBids,
    isLoading,
    setProxyBid,
    cancelProxyBid,
    toggleProxyBid,
    isSettingProxyBid: setProxyBidMutation.isPending,
    isCancelling: cancelProxyBidMutation.isPending,
  };
};
