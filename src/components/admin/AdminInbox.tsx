import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  MailOpen,
  Archive,
  Trash2,
  Search,
  RefreshCw,
  Paperclip,
  Clock,
  User,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface InboundEmail {
  id: string;
  from_address: string;
  to_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean;
  attachment_count: number;
  received_at: string | null;
  created_at: string;
  is_read: boolean;
  is_archived: boolean;
}

const AdminInbox = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: emails, isLoading, refetch } = useQuery({
    queryKey: ["inbound-emails", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InboundEmail[];
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ is_read: true })
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    },
  });

  const archiveEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ is_archived: true })
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      setSelectedEmail(null);
      toast.success("Email archived");
    },
  });

  const handleEmailClick = (email: InboundEmail) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const filteredEmails = emails?.filter(
    (email) =>
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = emails?.filter((e) => !e.is_read).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email Inbox</h2>
          <p className="text-muted-foreground">
            Emails received at @1145lifestyle.com
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
            {unreadCount} unread
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Email List */}
        <Card className="flex-1 max-w-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Button
                variant={showArchived ? "outline" : "default"}
                size="sm"
                onClick={() => setShowArchived(false)}
              >
                <Mail className="h-4 w-4 mr-1" />
                Inbox
              </Button>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={() => setShowArchived(true)}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archived
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading emails...
                </div>
              ) : filteredEmails?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No emails found</p>
                </div>
              ) : (
                filteredEmails?.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedEmail?.id === email.id ? "bg-muted" : ""
                    } ${!email.is_read ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {email.is_read ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Mail className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm truncate ${
                              !email.is_read ? "font-semibold" : ""
                            }`}
                          >
                            {email.from_address}
                          </p>
                          {email.has_attachments && (
                            <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <p
                          className={`text-sm truncate ${
                            !email.is_read ? "font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {email.received_at
                            ? format(new Date(email.received_at), "MMM d, h:mm a")
                            : format(new Date(email.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Email Content */}
        <Card className="flex-[2]">
          {selectedEmail ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEmail(null)}
                    className="md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => archiveEmailMutation.mutate(selectedEmail.id)}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-xl mt-2">{selectedEmail.subject}</CardTitle>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{selectedEmail.from_address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {selectedEmail.received_at
                        ? format(new Date(selectedEmail.received_at), "PPpp")
                        : format(new Date(selectedEmail.created_at), "PPpp")}
                    </span>
                  </div>
                  {selectedEmail.has_attachments && (
                    <div className="flex items-center gap-1">
                      <Paperclip className="h-4 w-4" />
                      <span>{selectedEmail.attachment_count} attachment(s)</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  To: {selectedEmail.to_addresses?.join(", ")}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <ScrollArea className="h-[500px]">
                  {selectedEmail.body_html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {selectedEmail.body_text || "(No content)"}
                    </pre>
                  )}
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="h-[650px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Select an email to read</p>
                <p className="text-sm mt-1">
                  Click on an email from the list to view its contents
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminInbox;
