import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  onTicketCreated?: () => void;
}

export const NewTicketDialog: React.FC<NewTicketDialogProps> = ({ 
  open, 
  onOpenChange, 
  vendorId,
  onTicketCreated 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    priority: "medium" as const,
    description: ""
  });

  const createTicket = async () => {
    if (!formData.subject || !formData.category || !formData.description) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          vendor_id: vendorId,
          subject: formData.subject,
          category: formData.category,
          priority: formData.priority,
          description: formData.description,
          status: 'open'
        }]);

      if (error) throw error;

      toast({
        title: "Ticket created",
        description: "Your support ticket has been submitted successfully."
      });

      setFormData({
        subject: "",
        category: "",
        priority: "medium",
        description: ""
      });
      
      onOpenChange(false);
      onTicketCreated?.();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create support ticket"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue and we'll help you resolve it quickly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="Brief description of your issue"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({...formData, category: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical Issue</SelectItem>
                  <SelectItem value="payments">Payments & Billing</SelectItem>
                  <SelectItem value="products">Product Management</SelectItem>
                  <SelectItem value="orders">Orders & Fulfillment</SelectItem>
                  <SelectItem value="account">Account & Settings</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value: any) => setFormData({...formData, priority: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - General inquiry</SelectItem>
                <SelectItem value="medium">Medium - Issue affecting business</SelectItem>
                <SelectItem value="high">High - Urgent business impact</SelectItem>
                <SelectItem value="urgent">Urgent - Critical issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Please provide details about your issue, including any error messages or steps to reproduce..."
              className="min-h-[120px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={createTicket} disabled={loading}>
            {loading ? "Creating..." : "Create Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};