
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Bell, Users, Store, Globe, Loader2, RefreshCw, Truck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  recipient_count: number;
  sent_at: string;
}

const AdminNotifications: React.FC = () => {
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    type: "announcement",
    audience: "all",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchSentNotifications();
  }, []);

  const fetchSentNotifications = async () => {
    try {
      setLoading(true);
      // Fetch recent admin-sent announcements from user_notifications
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("type", "announcement")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by title+message+created_at to show unique announcements
      const grouped: Record<string, SentNotification> = {};
      (data || []).forEach(n => {
        const key = `${n.title}|${n.message}|${n.created_at.slice(0, 19)}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: n.id,
            title: n.title,
            message: n.message,
            type: (n.data as any)?.notification_type || "announcement",
            audience: (n.data as any)?.audience || "all",
            recipient_count: 1,
            sent_at: n.created_at,
          };
        } else {
          grouped[key].recipient_count++;
        }
      });

      setSentNotifications(Object.values(grouped));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in title and message." });
      return;
    }

    setSending(true);
    try {
      // Determine target users based on audience
      let targetUserIds: string[] = [];

      if (newNotification.audience === "all") {
        const { data } = await supabase.from("profiles").select("id");
        targetUserIds = (data || []).map(p => p.id);
      } else {
        // Map audience to role
        const roleMap: Record<string, "consumer" | "vendor" | "driver" | "influencer"> = {
          consumers: "consumer",
          merchants: "vendor",
          vendors: "vendor",
          drivers: "driver",
          influencers: "influencer",
        };
        const role = roleMap[newNotification.audience];
        if (role) {
          const { data } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", role);
          targetUserIds = (data || []).map(r => r.user_id);
        }
      }

      if (targetUserIds.length === 0) {
        toast({ variant: "destructive", title: "No recipients", description: "No users found for the selected audience." });
        setSending(false);
        return;
      }

      // Insert notifications for all target users
      const notifications = targetUserIds.map(uid => ({
        user_id: uid,
        type: "announcement",
        title: newNotification.title,
        message: newNotification.message,
        read: false,
        data: {
          notification_type: newNotification.type,
          audience: newNotification.audience,
          sent_by: user?.id,
        },
      }));

      // Insert in batches of 500
      for (let i = 0; i < notifications.length; i += 500) {
        const batch = notifications.slice(i, i + 500);
        const { error } = await supabase.from("user_notifications").insert(batch);
        if (error) throw error;
      }

      toast({
        title: "Notification sent!",
        description: `Sent to ${targetUserIds.length} user(s).`,
      });

      setNewNotification({ title: "", message: "", type: "announcement", audience: "all" });
      fetchSentNotifications();
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to send notification." });
    } finally {
      setSending(false);
    }
  };

  const getAudienceIcon = (audience: string) => {
    switch (audience) {
      case "merchants": case "vendors": return <Store className="h-4 w-4" />;
      case "consumers": return <Users className="h-4 w-4" />;
      case "drivers": return <Truck className="h-4 w-4" />;
      case "influencers": return <Sparkles className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string): "destructive" | "secondary" | "default" | "outline" => {
    switch (type) {
      case "alert": return "destructive";
      case "maintenance": return "secondary";
      case "promotion": return "default";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">Notifications Management</h2>
        <Button variant="outline" onClick={fetchSentNotifications}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="w-full flex h-auto">
          <TabsTrigger value="send" className="flex-1">Send Notification</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">Notification History</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send New Notification</CardTitle>
              <CardDescription>
                Send announcements, promotions, or alerts to users. Notifications will appear in their dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Notification Type</label>
                  <Select value={newNotification.type} onValueChange={value => setNewNotification({ ...newNotification, type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Target Audience</label>
                  <Select value={newNotification.audience} onValueChange={value => setNewNotification({ ...newNotification, audience: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="consumers">Consumers Only</SelectItem>
                      <SelectItem value="merchants">Merchants Only</SelectItem>
                      <SelectItem value="drivers">Drivers Only</SelectItem>
                      <SelectItem value="influencers">Influencers Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input placeholder="Notification title" value={newNotification.title} onChange={e => setNewNotification({ ...newNotification, title: e.target.value })} />
              </div>

              <div>
                <label className="text-sm font-medium">Message *</label>
                <Textarea placeholder="Notification message" value={newNotification.message} onChange={e => setNewNotification({ ...newNotification, message: e.target.value })} className="min-h-[100px]" />
              </div>

              <Button onClick={handleSendNotification} disabled={sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>Previously sent notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sentNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No notifications sent yet</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Send your first notification to engage with your users.
                  </p>
                </div>
              ) : (
                sentNotifications.map(notification => (
                  <div key={notification.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{notification.title}</h4>
                          <Badge variant={getTypeColor(notification.type)}>{notification.type}</Badge>
                          <Badge variant="outline" className="text-xs">
                            <div className="flex items-center gap-1">
                              {getAudienceIcon(notification.audience)}
                              {notification.audience}
                            </div>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      <Badge variant="default">{notification.recipient_count} recipients</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Sent: {new Date(notification.sent_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotifications;
