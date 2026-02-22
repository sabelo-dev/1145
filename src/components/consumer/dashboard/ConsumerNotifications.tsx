
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Package, Tag, MessageCircle, Trash2, Check, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: any;
  created_at: string;
}

const ConsumerNotifications: React.FC = () => {
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();

      const channel = supabase
        .channel("consumer_notifications")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read: true })
        .eq("id", notificationId);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to mark as read" });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast({ title: "Notification deleted" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete notification" });
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ read: true })
        .in("id", unreadIds);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast({ title: "All notifications marked as read" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to mark all as read" });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order": return <Package className="h-5 w-5 text-blue-500" />;
      case "promotion": return <Tag className="h-5 w-5 text-green-500" />;
      case "message": return <MessageCircle className="h-5 w-5 text-purple-500" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      order: "default", promotion: "secondary", message: "outline",
    };
    return <Badge variant={variants[type] || "secondary"}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <span className="text-lg font-medium">Notifications</span>
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>Mark All as Read</Button>
          )}
        </div>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread {unreadCount > 0 && `(${unreadCount})`}</TabsTrigger>
          <TabsTrigger value="order">Orders</TabsTrigger>
          <TabsTrigger value="promotion">Deals</TabsTrigger>
          <TabsTrigger value="message">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No notifications</h3>
                  <p className="text-muted-foreground text-center">
                    {filter === "unread" ? "You're all caught up!" : `No ${filter === "all" ? "" : filter} notifications.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map(notification => (
                <Card key={notification.id} className={`${!notification.read ? "border-l-4 border-l-primary" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium ${!notification.read ? "font-semibold" : ""}`}>{notification.title}</h4>
                            {getNotificationBadge(notification.type)}
                            {!notification.read && <div className="w-2 h-2 bg-primary rounded-full" />}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        {!notification.read && (
                          <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerNotifications;
