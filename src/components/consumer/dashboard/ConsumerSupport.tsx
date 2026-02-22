
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Plus, MessageCircle, Phone, Mail, FileText, Loader2, RefreshCw, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ConsumerSupport: React.FC = () => {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOrderNumber, setNewOrderNumber] = useState("");

  // Email form
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Live chat
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string }[]>([
    { from: "system", text: "Welcome to live chat! A support agent will be with you shortly." },
  ]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (user?.id) fetchTickets();
  }, [user?.id]);

  const fetchTickets = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!user?.id || !newSubject || !newCategory) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all required fields." });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: newSubject,
        description: newDescription + (newOrderNumber ? `\n\nOrder: ${newOrderNumber}` : ""),
        category: newCategory,
        priority: newPriority,
        status: "open",
      });
      if (error) throw error;
      toast({ title: "Ticket Created", description: "Your support ticket has been submitted." });
      setIsNewTicketOpen(false);
      setNewSubject("");
      setNewDescription("");
      setNewCategory("");
      setNewPriority("medium");
      setNewOrderNumber("");
      fetchTickets();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create ticket." });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const { error } = await supabase.from("support_tickets").delete().eq("id", ticketId).eq("user_id", user?.id);
      if (error) throw error;
      toast({ title: "Ticket Deleted" });
      fetchTickets();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete ticket." });
    }
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { from: "user", text: chatInput }]);
    setChatInput("");
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { from: "agent", text: "Thank you for your message. An agent will respond shortly. In the meantime, you can create a support ticket for faster resolution." },
      ]);
    }, 1500);
  };

  const handleSendEmail = () => {
    window.location.href = `mailto:support@1145lifestyle.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    setEmailDialogOpen(false);
    setEmailSubject("");
    setEmailBody("");
    toast({ title: "Email client opened", description: "Complete sending in your email app." });
  };

  const handleCallNow = () => {
    window.location.href = "tel:+27123456789";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      open: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge variant="outline" className={config[status] || ""}>
        {status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = { low: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", high: "bg-red-100 text-red-800" };
    return <Badge variant="outline" className={colors[priority] || ""}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Badge>;
  };

  const faqItems = [
    { question: "How do I track my order?", answer: "Go to 'My Orders' section and click on the order to see tracking info." },
    { question: "What is your return policy?", answer: "We offer a 30-day return policy for most items in original condition." },
    { question: "How do I redeem loyalty points?", answer: "Points can be redeemed at checkout. 100 points = R1.00." },
    { question: "How do I cancel an order?", answer: "Orders can be cancelled within 1 hour if not yet processed. Go to 'My Orders' and click 'Cancel'." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          <span className="text-lg font-medium">Support Center</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTickets}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">Order Issues</SelectItem>
                      <SelectItem value="refund">Refund Request</SelectItem>
                      <SelectItem value="account">Account Problems</SelectItem>
                      <SelectItem value="product">Product Questions</SelectItem>
                      <SelectItem value="technical">Technical Issues</SelectItem>
                      <SelectItem value="general">General Inquiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject *</label>
                  <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief description of your issue" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Please provide detailed information..." rows={4} />
                </div>
                <div>
                  <label className="text-sm font-medium">Order Number (optional)</label>
                  <Input value={newOrderNumber} onChange={e => setNewOrderNumber(e.target.value)} placeholder="e.g., ORD-001" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateTicket} disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create Ticket
                  </Button>
                  <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageCircle className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Available 24/7</p>
            </div>
            <Dialog open={liveChatOpen} onOpenChange={setLiveChatOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto">Start Chat</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Live Chat Support</DialogTitle></DialogHeader>
                <div className="h-64 overflow-y-auto border rounded p-3 space-y-2 bg-muted/30">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`text-sm p-2 rounded ${msg.from === "user" ? "bg-primary text-primary-foreground ml-8" : "bg-muted mr-8"}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === "Enter" && handleSendChatMessage()} />
                  <Button onClick={handleSendChatMessage}>Send</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Phone className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Phone Support</h3>
              <p className="text-sm text-muted-foreground">+27 123 456 789</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={handleCallNow}>Call Now</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Email Support</h3>
              <p className="text-sm text-muted-foreground">support@1145lifestyle.com</p>
            </div>
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto">Send Email</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Send Email to Support</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Subject</label>
                    <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Issue subject" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={4} placeholder="Describe your issue..." />
                  </div>
                  <Button onClick={handleSendEmail}>Open Email Client</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card>
        <CardHeader><CardTitle>My Support Tickets</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No support tickets</h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven't created any support tickets yet.
              </p>
              <Button onClick={() => setIsNewTicketOpen(true)}>Create Your First Ticket</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map(ticket => (
                <div key={ticket.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-medium">{ticket.id.slice(0, 8).toUpperCase()}</span>
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <h4 className="font-medium mb-1">{ticket.subject}</h4>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{ticket.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Created: {format(new Date(ticket.created_at), "PPp")}
                        {ticket.updated_at && ` • Updated: ${format(new Date(ticket.updated_at), "PPp")}`}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedTicket(ticket); setDetailsOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteTicket(ticket.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Ticket Details</DialogTitle></DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{selectedTicket.id.slice(0, 8).toUpperCase()}</span>
                {getStatusBadge(selectedTicket.status)}
                {getPriorityBadge(selectedTicket.priority)}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subject</label>
                <p className="font-medium">{selectedTicket.subject}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p>{selectedTicket.category?.replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                Created: {format(new Date(selectedTicket.created_at), "PPp")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqItems.map((faq, i) => (
              <div key={i} className="border-b pb-4 last:border-b-0">
                <h4 className="font-medium mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsumerSupport;
