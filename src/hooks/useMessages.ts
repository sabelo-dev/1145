import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Conversation {
  id: string;
  store_id: string;
  customer_id: string;
  subject: string;
  type: 'customer_inquiry' | 'order_support' | 'admin_notification';
  status: 'open' | 'resolved' | 'pending';
  order_id: string | null;
  last_message_at: string;
  created_at: string;
  // Enriched fields
  storeName?: string;
  unreadCount: number;
  lastMessage?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'vendor' | 'admin';
  content: string;
  read: boolean;
  created_at: string;
  // Enriched fields
  senderName?: string;
  isFromMe: boolean;
}

export function useMessages(userType: 'consumer' | 'vendor' = 'consumer') {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch conversations for the current user
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      let query = supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (userType === 'consumer') {
        query = query.eq('customer_id', user.id);
      } else {
        // For vendors, get their store IDs first
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!vendor) {
          setConversations([]);
          return;
        }

        const { data: stores } = await supabase
          .from('stores')
          .select('id')
          .eq('vendor_id', vendor.id);

        if (!stores || stores.length === 0) {
          setConversations([]);
          return;
        }

        query = query.in('store_id', stores.map(s => s.id));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich conversations with store names and unread counts
      const enrichedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          // Get store name
          const { data: store } = await supabase
            .from('stores')
            .select('name')
            .eq('id', conv.store_id)
            .single();

          // Get unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_type', userType === 'consumer' ? 'customer' : 'vendor');

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            storeName: store?.name || 'Unknown Store',
            unreadCount: count || 0,
            lastMessage: lastMsg?.content || '',
          } as Conversation;
        })
      );

      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load conversations',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, userType, toast]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Enrich messages with sender names
      const enrichedMessages = await Promise.all(
        (data || []).map(async (msg) => {
          const isFromMe = 
            (userType === 'consumer' && msg.sender_type === 'customer') ||
            (userType === 'vendor' && msg.sender_type === 'vendor');

          let senderName = 'Unknown';
          
          if (isFromMe) {
            senderName = 'You';
          } else if (msg.sender_type === 'admin') {
            senderName = 'Support';
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', msg.sender_id)
              .single();
            senderName = profile?.name || profile?.email || 'Unknown';
          }

          return {
            ...msg,
            senderName,
            isFromMe,
          } as Message;
        })
      );

      setMessages(enrichedMessages);

      // Mark messages as read
      const senderTypeToMark = userType === 'consumer' ? 'vendor' : 'customer';
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', senderTypeToMark)
        .eq('read', false);

      // Update local unread count
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unreadCount: 0 } 
            : conv
        )
      );
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [user, userType]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !selectedConversationId || !content.trim()) return false;

    try {
      setIsSending(true);

      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConversationId,
          sender_id: user.id,
          sender_type: userType === 'consumer' ? 'customer' : 'vendor',
          content: content.trim(),
          read: false,
        }]);

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversationId);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message',
      });
      return false;
    } finally {
      setIsSending(false);
    }
  }, [user, selectedConversationId, userType, toast]);

  // Create a new conversation
  const createConversation = useCallback(async (
    storeId: string,
    subject: string,
    type: 'customer_inquiry' | 'order_support' = 'customer_inquiry',
    orderId?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert([{
          store_id: storeId,
          customer_id: user.id,
          subject,
          type,
          order_id: orderId || null,
          status: 'open',
        }])
        .select()
        .single();

      if (error) throw error;

      await fetchConversations();
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start conversation',
      });
      return null;
    }
  }, [user, fetchConversations, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const setupRealtimeSubscription = () => {
      // Clean up existing subscriptions
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (conversationChannelRef.current) {
        supabase.removeChannel(conversationChannelRef.current);
      }

      // Subscribe to messages for the selected conversation
      if (selectedConversationId) {
        channelRef.current = supabase
          .channel(`messages:${selectedConversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${selectedConversationId}`,
            },
            async (payload) => {
              const newMsg = payload.new as any;
              
              // Only process if not from current user
              const isFromMe = 
                (userType === 'consumer' && newMsg.sender_type === 'customer') ||
                (userType === 'vendor' && newMsg.sender_type === 'vendor');

              let senderName = 'Unknown';
              if (isFromMe) {
                senderName = 'You';
              } else if (newMsg.sender_type === 'admin') {
                senderName = 'Support';
              } else {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('name, email')
                  .eq('id', newMsg.sender_id)
                  .single();
                senderName = profile?.name || profile?.email || 'Unknown';
              }

              const enrichedMessage: Message = {
                ...newMsg,
                senderName,
                isFromMe,
              };

              setMessages(prev => [...prev, enrichedMessage]);

              // Mark as read if it's from the other party
              if (!isFromMe) {
                await supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('id', newMsg.id);
              }
            }
          )
          .subscribe();
      }

      // Subscribe to conversation updates
      conversationChannelRef.current = supabase
        .channel('conversations-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          () => {
            // Refresh conversations to update unread counts and last messages
            fetchConversations();
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (conversationChannelRef.current) {
        supabase.removeChannel(conversationChannelRef.current);
      }
    };
  }, [user, selectedConversationId, userType, fetchConversations]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, fetchMessages]);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  return {
    conversations,
    messages,
    selectedConversation,
    selectedConversationId,
    setSelectedConversationId,
    isLoading,
    isSending,
    sendMessage,
    createConversation,
    refreshConversations: fetchConversations,
    refreshMessages: () => selectedConversationId && fetchMessages(selectedConversationId),
  };
}
