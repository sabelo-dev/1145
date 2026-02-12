import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onMessageSent?: () => void;
}

export const NewMessageDialog: React.FC<NewMessageDialogProps> = ({ 
  open, 
  onOpenChange, 
  storeId,
  onMessageSent 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_email: "",
    subject: "",
    message: "",
    type: "customer_inquiry" as const
  });

  const sendMessage = async () => {
    if (!formData.customer_email || !formData.subject || !formData.message) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all fields"
      });
      return;
    }

    try {
      setLoading(true);

      // Find customer by email
      const { data: customerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.customer_email)
        .single();

      if (profileError) {
        toast({
          variant: "destructive",
          title: "Customer not found",
          description: "No customer found with that email address"
        });
        return;
      }

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          store_id: storeId,
          customer_id: customerProfile.id,
          subject: formData.subject,
          type: formData.type,
          status: 'open'
        }])
        .select()
        .single();

      if (convError) throw convError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "You must be logged in to send messages"
        });
        return;
      }

      // Create first message
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_type: 'vendor',
          content: formData.message,
          read: false
        }]);

      if (messageError) throw messageError;

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully."
      });

      setFormData({
        customer_email: "",
        subject: "",
        message: "",
        type: "customer_inquiry"
      });
      
      onOpenChange(false);
      onMessageSent?.();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Send a message to a customer
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer Email *</Label>
            <Input
              id="customer-email"
              type="email"
              value={formData.customer_email}
              onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-type">Message Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: any) => setFormData({...formData, type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_inquiry">Customer Inquiry</SelectItem>
                <SelectItem value="order_support">Order Support</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="Message subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Type your message here..."
              rows={5}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={sendMessage} disabled={loading}>
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};