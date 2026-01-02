
import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Search, MessageSquare, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ticket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  category: "order" | "product" | "refund" | "account" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: string;
  lastUpdated: string;
  description: string;
}

const AdminDisputes: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // In production, fetch from Supabase support_tickets table
    setLoading(false);
  }, []);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleUpdateStatus = (ticketId: string, newStatus: Ticket["status"]) => {
    setTickets(tickets.map(ticket =>
      ticket.id === ticketId ? { ...ticket, status: newStatus, lastUpdated: new Date().toISOString() } : ticket
    ));

    toast({
      title: "Ticket status updated",
      description: `Ticket has been marked as ${newStatus}.`,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "outline";
      case "low": return "default";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "destructive";
      case "in_progress": return "outline";
      case "resolved": return "default";
      case "closed": return "default";
      default: return "default";
    }
  };

  const openTickets = tickets.filter(t => t.status === "open").length;
  const highPriorityTickets = tickets.filter(t => t.priority === "high" || t.priority === "urgent").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Support & Dispute Management</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets}</div>
            <p className="text-xs text-muted-foreground">
              Needs attention
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityTickets}</div>
            <p className="text-xs text-muted-foreground">
              Urgent resolution needed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              No data yet
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              No data yet
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            size="sm"
          >
            All Status
          </Button>
          <Button 
            variant={statusFilter === "open" ? "default" : "outline"}
            onClick={() => setStatusFilter("open")}
            size="sm"
          >
            Open
          </Button>
          <Button 
            variant={statusFilter === "in_progress" ? "default" : "outline"}
            onClick={() => setStatusFilter("in_progress")}
            size="sm"
          >
            In Progress
          </Button>
          <Button 
            variant={priorityFilter === "high" ? "default" : "outline"}
            onClick={() => setPriorityFilter(priorityFilter === "high" ? "all" : "high")}
            size="sm"
          >
            High Priority
          </Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No support tickets</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Customer support tickets will appear here when submitted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Support tickets and disputes</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead className="hidden sm:table-cell">Customer</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{ticket.ticketNumber}</div>
                          <div className="text-sm text-muted-foreground line-clamp-1">{ticket.subject}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div>
                          <div className="font-medium">{ticket.customerName}</div>
                          <div className="text-sm text-muted-foreground">{ticket.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={getStatusColor(ticket.status)}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {ticket.status === "open" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(ticket.id, "in_progress");
                              }}
                            >
                              Start
                            </Button>
                          )}
                          {ticket.status === "in_progress" && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(ticket.id, "resolved");
                              }}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Ticket Detail Panel */}
          <div>
            {selectedTicket ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span>{selectedTicket.ticketNumber}</span>
                    <Badge variant={getPriorityColor(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{selectedTicket.subject}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Customer Information</h4>
                    <p className="text-sm">{selectedTicket.customerName}</p>
                    <p className="text-sm text-muted-foreground">{selectedTicket.customerEmail}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm">{selectedTicket.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Timeline</h4>
                    <p className="text-sm">Created: {new Date(selectedTicket.createdAt).toLocaleString()}</p>
                    <p className="text-sm">Last Updated: {new Date(selectedTicket.lastUpdated).toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Add Response</h4>
                    <Textarea placeholder="Type your response..." className="mb-2" />
                    <Button className="w-full sm:w-auto">Send Response</Button>
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
