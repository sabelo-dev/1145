import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Plus, MessageCircle, Phone, Mail, FileText } from "lucide-react";

const ConsumerSupport: React.FC = () => {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  // Mock data - replace with actual API calls
  const supportTickets = [
    {
      id: "TK-12345",
      subject: "Refund Request for Order ORD-003",
      status: "in_progress",
      priority: "medium",
      created: "2024-01-12",
      lastUpdate: "2024-01-14",
      category: "refund",
      description: "I received a damaged product and would like to request a refund."
    },
    {
      id: "TK-12344",
      subject: "Account Login Issues",
      status: "resolved",
      priority: "high",
      created: "2024-01-08",
      lastUpdate: "2024-01-09",
      category: "account",
      description: "Unable to log into my account after password reset."
    },
    {
      id: "TK-12343",
      subject: "Question about Loyalty Points",
      status: "closed",
      priority: "low",
      created: "2024-01-05",
      lastUpdate: "2024-01-06",
      category: "general",
      description: "How do I redeem my loyalty points for discounts?"
    }
  ];

  const faqItems = [
    {
      question: "How do I track my order?",
      answer: "You can track your order by going to 'My Orders' section in your dashboard. Click on the order you want to track and you'll see the tracking information if available."
    },
    {
      question: "What is your return policy?",
      answer: "We offer a 30-day return policy for most items. Items must be in original condition with tags attached. Some restrictions apply for certain categories."
    },
    {
      question: "How do I redeem loyalty points?",
      answer: "Loyalty points can be redeemed at checkout. 100 points = R1.00. You'll see the option to apply points during the payment process."
    },
    {
      question: "How do I cancel an order?",
      answer: "Orders can be cancelled within 1 hour of placement if they haven't been processed yet. Go to 'My Orders' and click 'Cancel' if the option is available."
    }
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      open: "secondary",
      in_progress: "default",
      resolved: "outline",
      closed: "secondary"
    } as const;

    const colors = {
      open: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-red-100 text-red-800"
    };

    return (
      <Badge variant="outline" className={colors[priority as keyof typeof colors]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          <span className="text-lg font-medium">Support Center</span>
        </div>
        <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
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
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input placeholder="Brief description of your issue" />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Please provide detailed information about your issue..."
                  rows={4}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Order Number (if applicable)</label>
                <Input placeholder="e.g., ORD-001" />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => setIsNewTicketOpen(false)}>
                  Create Ticket
                </Button>
                <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Button variant="outline" size="sm" className="ml-auto">
              Start Chat
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Phone className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Phone Support</h3>
              <p className="text-sm text-muted-foreground">+27 123 456 789</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Call Now
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-medium">Email Support</h3>
              <p className="text-sm text-muted-foreground">support@1145lifestyle.com</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Send Email
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>My Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {supportTickets.map((ticket) => (
              <div key={ticket.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{ticket.id}</span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <h4 className="font-medium mb-1">{ticket.subject}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {ticket.description}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Created: {ticket.created} • Last update: {ticket.lastUpdate}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqItems.map((faq, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <h4 className="font-medium mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {supportTickets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No support tickets</h3>
            <p className="text-muted-foreground text-center mb-4">
              You haven't created any support tickets yet. If you need help, feel free to create one!
            </p>
            <Button onClick={() => setIsNewTicketOpen(true)}>
              Create Your First Ticket
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConsumerSupport;