import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NewMessageDialog } from "./dialogs/NewMessageDialog";
import { 
  MessageSquare, 
  Search, 
  Send, 
  User, 
  Shield, 
  Clock, 
  CheckCheck,
  Plus,
  Filter,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VendorMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [filter, setFilter] = useState<'all' | 'unread' | 'customer' | 'admin'>('all');
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (vendorError || !vendor) {
        setConversations([]);
        return;
      }

      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id);

      if (storesError || !stores || stores.length === 0) {
        setConversations([]);
        return;
      }

      const storeIds = stores.map(store => store.id);
      setStoreId(stores[0].id);

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .in('store_id', storeIds)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get customer profiles and unread count
      const conversationsWithUnread = await Promise.all(
        (data || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', conv.customer_id)
            .single();

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_type', 'vendor');

          return {
            ...conv,
            unreadCount: count || 0,
            customerName: profile?.name || profile?.email || 'Unknown',
            lastMessage: '',
            lastMessageTime: new Date(conv.last_message_at).toLocaleTimeString()
          };
        })
      );

      setConversations(conversationsWithUnread);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch conversations"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles separately
      const messagesWithSenders = await Promise.all(
        (data || []).map(async (msg) => {
          if (msg.sender_type === 'vendor') {
            return {
              id: msg.id,
              conversationId: msg.conversation_id,
              sender: msg.sender_type,
              senderName: 'You',
              content: msg.content,
              timestamp: new Date(msg.created_at).toLocaleTimeString(),
              read: msg.read
            };
          }
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', msg.sender_id)
            .single();

          return {
            id: msg.id,
            conversationId: msg.conversation_id,
            sender: msg.sender_type,
            senderName: profile?.name || profile?.email || 'Unknown',
            content: msg.content,
            timestamp: new Date(msg.created_at).toLocaleTimeString(),
            read: msg.read
          };
        })
      );

      setMessages(messagesWithSenders);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_type', 'vendor');

    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConversation,
          sender_id: user.id,
          sender_type: 'vendor',
          content: newMessage,
          read: false
        }]);

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      setNewMessage("");
      fetchMessages(selectedConversation);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message"
      });
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (filter === 'unread' && conv.unreadCount === 0) return false;
    if (filter === 'customer' && conv.type === 'admin_notification') return false;
    if (filter === 'admin' && conv.type !== 'admin_notification') return false;
    
    return conv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           conv.subject.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'admin_notification':
        return <Shield className="h-4 w-4" />;
      case 'order_support':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'resolved':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return <div>Loading messages...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Messages</h2>
          <p className="text-muted-foreground">Communicate with customers and support</p>
        </div>
        <Button onClick={() => setNewMessageDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilter('all')}>
                    All Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter('unread')}>
                    Unread Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter('customer')}>
                    Customer Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter('admin')}>
                    Admin Messages
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-1 p-4 pt-0">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConversation === conversation.id
                          ? 'bg-muted'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {conversation.customerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${getStatusColor(conversation.status)}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(conversation.type)}
                              <span className="font-medium text-sm truncate">
                                {conversation.customerName}
                              </span>
                            </div>
                            {conversation.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mb-1">
                            {conversation.subject}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {conversation.lastMessageTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          {selectedConv ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {selectedConv.customerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedConv.customerName}</CardTitle>
                      <CardDescription>{selectedConv.subject}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={async () => {
                        await supabase
                          .from('conversations')
                          .update({ status: 'resolved' })
                          .eq('id', selectedConversation);
                        fetchConversations();
                      }}>
                        Mark as resolved
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[450px] p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.sender === 'vendor' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {message.senderName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className={`flex-1 max-w-xs ${
                          message.sender === 'vendor' ? 'text-right' : ''
                        }`}>
                          <div className={`inline-block p-3 rounded-lg ${
                            message.sender === 'vendor'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{message.timestamp}</span>
                            {message.sender === 'vendor' && message.read && (
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <Separator />
                
                <div className="p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 min-h-[80px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the left to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {storeId && (
        <NewMessageDialog
          open={newMessageDialogOpen}
          onOpenChange={setNewMessageDialogOpen}
          storeId={storeId}
          onMessageSent={fetchConversations}
        />
      )}
    </div>
  );
};

export default VendorMessages;
