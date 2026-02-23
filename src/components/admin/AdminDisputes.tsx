
import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquare, Clock, AlertTriangle, Loader2, Send, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Ticket {
  id: string;
  user_id: string | null;
  vendor_id: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
  user_role?: string;
  store_name?: string;
}

const AdminDisputes: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      // Fetch all support tickets (admin RLS allows this)
      const { data: ticketsData, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with user profile info
      const userIds = [...new Set((ticketsData || []).map(t => t.user_id).filter(Boolean))];
      const vendorIds = [...new Set((ticketsData || []).map(t => t.vendor_id).filter(Boolean))];

      let profilesMap: Record<string, any> = {};
      let rolesMap: Record<string, string> = {};
      let vendorStoreMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);
        (profiles || []).forEach(p => { profilesMap[p.id] = p; });

        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        (roles || []).forEach(r => {
          // Pick highest priority role
          const priority: Record<string, number> = { admin: 5, influencer: 4, driver: 3, merchant: 2, vendor: 2, consumer: 1 };
          const existing = rolesMap[r.user_id];
          if (!existing || (priority[r.role] || 0) > (priority[existing] || 0)) {
            rolesMap[r.user_id] = r.role;
          }
        });
      }

      if (vendorIds.length > 0) {
        const { data: stores } = await supabase
          .from("stores")
          .select("id, vendor_id, name")
          .in("vendor_id", vendorIds);
        (stores || []).forEach(s => { vendorStoreMap[s.vendor_id] = s.name; });
      }

      const enriched: Ticket[] = (ticketsData || []).map(t => ({
        ...t,
        user_name: profilesMap[t.user_id]?.name || "Unknown",
        user_email: profilesMap[t.user_id]?.email || "",
        user_role: rolesMap[t.user_id] || "consumer",
        store_name: t.vendor_id ? vendorStoreMap[t.vendor_id] : undefined,
      }));

      setTickets(enriched);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch support tickets" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;

      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast({ title: "Status updated", description: `Ticket marked as ${newStatus.replace("_", " ")}` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update ticket status" });
    }
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !responseText.trim() || !user?.id) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({
          admin_response: responseText,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTicket.id);
      if (error) throw error;

      // Notify the user who created the ticket
      if (selectedTicket.user_id) {
        await supabase.from("user_notifications").insert({
          user_id: selectedTicket.user_id,
          type: "message",
          title: "Support Response",
          message: `Your ticket "${selectedTicket.subject}" has received a response from support.`,
          read: false,
          data: { ticket_id: selectedTicket.id },
        });
      }

      setSelectedTicket(prev => prev ? {
        ...prev,
        admin_response: responseText,
        responded_by: user.id,
        responded_at: new Date().toISOString(),
        status: "in_progress",
      } : null);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? {
        ...t, admin_response: responseText, status: "in_progress",
      } : t));
      setResponseText("");
      toast({ title: "Response sent", description: "User has been notified." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to send response" });
    } finally {
      setSending(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string): "destructive" | "outline" | "default" | "secondary" => {
    switch (priority) {
      case "urgent": case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string): "destructive" | "outline" | "default" | "secondary" => {
    switch (status) {
      case "open": return "destructive";
      case "in_progress": return "secondary";
      case "resolved": return "default";
      default: return "outline";
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      consumer: "bg-blue-100 text-blue-800",
      merchant: "bg-purple-100 text-purple-800",
      vendor: "bg-purple-100 text-purple-800",
      driver: "bg-orange-100 text-orange-800",
      influencer: "bg-pink-100 text-pink-800",
      admin: "bg-red-100 text-red-800",
    };
    return <Badge variant="outline" className={colors[role] || ""}>{role}</Badge>;
  };

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;
  const highPriorityCount = tickets.filter(t => t.priority === "high" || t.priority === "urgent").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">Support & Dispute Management</h2>
        <Button variant="outline" onClick={fetchTickets}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openCount}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground">Being handled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityCount}</div>
            <p className="text-xs text-muted-foreground">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by subject, user name, email, or ticket ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "open", "in_progress", "resolved", "closed"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No support tickets</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {tickets.length === 0 ? "No tickets have been submitted yet." : "No tickets match the current filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Ticket List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredTickets.map(ticket => (
              <Card
                key={ticket.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => { setSelectedTicket(ticket); setResponseText(""); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs">{ticket.id.slice(0, 8).toUpperCase()}</span>
                        <Badge variant={getStatusColor(ticket.status)}>{ticket.status.replace("_", " ")}</Badge>
                        <Badge variant={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                        {getRoleBadge(ticket.user_role || "consumer")}
                      </div>
                      <h4 className="font-medium text-sm truncate">{ticket.subject}</h4>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{ticket.user_name}</span>
                    {ticket.user_email && <span className="ml-1">({ticket.user_email})</span>}
                  </div>
                  {ticket.store_name && (
                    <div className="text-xs text-muted-foreground mt-1">Store: {ticket.store_name}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(ticket.created_at), "PPp")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail Panel */}
          <div>
            {selectedTicket ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={getPriorityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                      <Badge variant={getStatusColor(selectedTicket.status)}>{selectedTicket.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <CardDescription>
                    From: {selectedTicket.user_name} ({selectedTicket.user_email}) • {getRoleBadge(selectedTicket.user_role || "consumer")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Category</h4>
                    <p className="text-sm">{selectedTicket.category?.replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {format(new Date(selectedTicket.created_at), "PPp")}
                    {selectedTicket.updated_at && ` • Updated: ${format(new Date(selectedTicket.updated_at), "PPp")}`}
                  </div>

                  {/* Previous admin response */}
                  {selectedTicket.admin_response && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-sm font-medium mb-1">Admin Response</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                      {selectedTicket.responded_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Responded: {format(new Date(selectedTicket.responded_at), "PPp")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Status actions */}
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, "in_progress")}>
                        Mark In Progress
                      </Button>
                    )}
                    {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
                      <Button size="sm" onClick={() => handleUpdateStatus(selectedTicket.id, "resolved")}>
                        Resolve
                      </Button>
                    )}
                    {selectedTicket.status === "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, "closed")}>
                        Close
                      </Button>
                    )}
                  </div>

                  {/* Response input */}
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="text-sm font-medium">Send Response</h4>
                    <Textarea
                      placeholder="Type your response to the user..."
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      rows={3}
                    />
                    <Button onClick={handleSendResponse} disabled={sending || !responseText.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send Response
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Select a ticket to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;
