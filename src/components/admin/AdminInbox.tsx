import React, { useEffect, useState } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  MailOpen,
  Archive,
  Search,
  RefreshCw,
  Paperclip,
  Clock,
  User,
  ArrowLeft,
  Send,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Folder = "inbox" | "archived" | "sent";

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

/** An email 1145 sent through Resend (list fields; the body is fetched on open). */
interface SentEmail {
  id: string;
  from: string;
  to: string[] | string;
  subject: string;
  created_at: string;
  last_event?: string | null;
  html?: string | null;
  text?: string | null;
}

// Every column the list shows; raw_payload (Resend's full payload) is left out.
const INBOX_COLUMNS =
  "id, from_address, to_addresses, subject, body_text, body_html, has_attachments, attachment_count, received_at, created_at, is_read, is_archived";

const recipients = (to: SentEmail["to"]) => (Array.isArray(to) ? to.join(", ") : to || "");

const safeFormat = (iso: string | null | undefined, pattern: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? format(d, pattern) : "";
};

async function invokeSent<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("resend-sent", { body });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Could not load sent emails");
  return data as T;
}

/**
 * Email HTML comes from outside senders, so it never touches the admin page's
 * DOM: it renders in a sandboxed frame with scripts, forms and same-origin
 * access all disabled.
 */
const EmailBody: React.FC<{ html: string | null | undefined; text: string | null | undefined }> = ({ html, text }) => {
  if (html) {
    return (
      <iframe
        title="Email content"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={`<base target="_blank"><meta name="referrer" content="no-referrer">${html}`}
        className="h-[500px] w-full rounded-md border bg-white"
      />
    );
  }
  return <pre className="whitespace-pre-wrap font-sans text-sm">{text || "(No content)"}</pre>;
};

const AdminInbox = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const received = useQuery({
    queryKey: ["inbound-emails", folder === "archived"],
    enabled: folder !== "sent",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select(INBOX_COLUMNS)
        .eq("is_archived", folder === "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InboundEmail[];
    },
  });

  const sent = useInfiniteQuery({
    queryKey: ["sent-emails"],
    enabled: folder === "sent",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      invokeSent<{ emails: SentEmail[]; has_more: boolean }>({ action: "list", after: pageParam }),
    getNextPageParam: (last) => (last.has_more && last.emails.length ? last.emails[last.emails.length - 1].id : undefined),
  });

  const sentDetail = useQuery({
    queryKey: ["sent-email", selectedSentId],
    enabled: !!selectedSentId,
    queryFn: () => invokeSent<{ email: SentEmail }>({ action: "get", id: selectedSentId }).then((r) => r.email),
  });

  // Pull in anything Resend received that the webhook did not deliver
  // (e.g. mail from before the webhook existed), then reload the list.
  const syncFromResend = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-inbox-sync", { body: {} });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Sync failed");
      if (data.stored > 0) toast.success(`${data.stored} new email${data.stored === 1 ? "" : "s"} imported`);
      if (data.failed > 0) toast.error(`${data.failed} email${data.failed === 1 ? "" : "s"} could not be imported`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync with Resend");
    } finally {
      setSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    }
  };

  const refresh = () => {
    if (folder === "sent") {
      queryClient.resetQueries({ queryKey: ["sent-emails"] });
    } else {
      syncFromResend();
    }
  };

  // Import missed mail once when the inbox is opened.
  useEffect(() => {
    syncFromResend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from("inbound_emails").update({ is_read: true }).eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbound-emails"] }),
  });

  const archiveEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from("inbound_emails").update({ is_archived: true }).eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      setSelectedEmail(null);
      toast.success("Email archived");
    },
    onError: (e) => toast.error((e as { message?: string })?.message || "Could not archive the email"),
  });

  const openFolder = (next: Folder) => {
    setFolder(next);
    setSelectedEmail(null);
    setSelectedSentId(null);
  };

  const handleEmailClick = (email: InboundEmail) => {
    setSelectedEmail(email);
    if (!email.is_read) markAsReadMutation.mutate(email.id);
  };

  const q = searchQuery.toLowerCase();
  const filteredReceived = (received.data || []).filter(
    (e) => e.subject.toLowerCase().includes(q) || e.from_address.toLowerCase().includes(q),
  );
  const sentEmails = (sent.data?.pages || []).flatMap((p) => p.emails);
  const filteredSent = sentEmails.filter(
    (e) => (e.subject || "").toLowerCase().includes(q) || recipients(e.to).toLowerCase().includes(q),
  );

  const unreadCount = folder === "inbox" ? (received.data || []).filter((e) => !e.is_read).length : 0;
  const listError = folder === "sent" ? sent.error : received.error;
  const listLoading = folder === "sent" ? sent.isLoading : received.isLoading;
  const hasSelection = folder === "sent" ? !!selectedSentId : !!selectedEmail;
  const selectedSent = sentDetail.data ?? sentEmails.find((e) => e.id === selectedSentId);

  const folderButton = (value: Folder, label: string, Icon: React.ElementType) => (
    <Button variant={folder === value ? "default" : "outline"} size="sm" onClick={() => openFolder(value)}>
      <Icon className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Email Inbox</h2>
          <p className="text-muted-foreground">
            {folder === "sent" ? "Emails 1145 has sent through Resend" : "Emails received at @1145.io"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folder === "inbox" && (
            <Badge variant={unreadCount > 0 ? "default" : "secondary"}>{unreadCount} unread</Badge>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={syncing || (folder === "sent" && sent.isFetching)}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing || (folder === "sent" && sent.isFetching) ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Phones show the list or the open email, not both */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Email List */}
        <Card className={`min-w-0 flex-1 md:max-w-md ${hasSelection ? "hidden md:block" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {folderButton("inbox", "Inbox", Mail)}
              {folderButton("sent", "Sent", Send)}
              {folderButton("archived", "Archived", Archive)}
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={folder === "sent" ? "Search subject or recipient..." : "Search emails..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh] md:h-[600px]">
              {listLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading emails...</div>
              ) : listError ? (
                <div className="p-8 text-center text-muted-foreground space-y-3">
                  <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
                  <p className="font-medium text-foreground">Emails could not be loaded</p>
                  <p className="text-sm">{(listError as { message?: string })?.message || "Please try again."}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => (folder === "sent" ? sent.refetch() : received.refetch())}
                  >
                    Retry
                  </Button>
                </div>
              ) : folder === "sent" ? (
                filteredSent.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No sent emails found</p>
                  </div>
                ) : (
                  <>
                    {filteredSent.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedSentId(email.id)}
                        className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedSentId === email.id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Send className="mt-1 h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm truncate">To: {recipients(email.to)}</p>
                              {email.last_event && (
                                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                                  {email.last_event.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm truncate text-muted-foreground">{email.subject || "(No Subject)"}</p>
                            <p className="text-xs text-muted-foreground mt-1">{safeFormat(email.created_at, "MMM d, h:mm a")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {sent.hasNextPage && (
                      <div className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => sent.fetchNextPage()} disabled={sent.isFetchingNextPage}>
                          {sent.isFetchingNextPage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Load older
                        </Button>
                      </div>
                    )}
                  </>
                )
              ) : filteredReceived.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No emails found</p>
                </div>
              ) : (
                filteredReceived.map((email) => (
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
                          <p className={`text-sm truncate ${!email.is_read ? "font-semibold" : ""}`}>{email.from_address}</p>
                          {email.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        </div>
                        <p className={`text-sm truncate ${!email.is_read ? "font-medium" : "text-muted-foreground"}`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {safeFormat(email.received_at || email.created_at, "MMM d, h:mm a")}
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
        <Card className={`min-w-0 md:flex-[2] ${hasSelection ? "" : "hidden md:block"}`}>
          {folder !== "sent" && selectedEmail ? (
            <>
              <CardHeader className="pb-3">
                <div className="header-row">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)} className="md:hidden">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  {!selectedEmail.is_archived && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button variant="outline" size="sm" onClick={() => archiveEmailMutation.mutate(selectedEmail.id)}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                    </div>
                  )}
                </div>
                <CardTitle className="text-xl mt-2">{selectedEmail.subject}</CardTitle>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{selectedEmail.from_address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{safeFormat(selectedEmail.received_at || selectedEmail.created_at, "PPpp")}</span>
                  </div>
                  {selectedEmail.has_attachments && (
                    <div className="flex items-center gap-1">
                      <Paperclip className="h-4 w-4" />
                      <span>{selectedEmail.attachment_count} attachment(s)</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">To: {selectedEmail.to_addresses?.join(", ")}</div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <EmailBody html={selectedEmail.body_html} text={selectedEmail.body_text} />
              </CardContent>
            </>
          ) : folder === "sent" && selectedSentId ? (
            <>
              <CardHeader className="pb-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedSentId(null)} className="md:hidden w-fit">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <CardTitle className="text-xl mt-2">{selectedSent?.subject || "(No Subject)"}</CardTitle>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{selectedSent?.from}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{safeFormat(selectedSent?.created_at, "PPpp")}</span>
                  </div>
                  {selectedSent?.last_event && (
                    <Badge variant="outline" className="capitalize">{selectedSent.last_event.replace(/_/g, " ")}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">To: {selectedSent ? recipients(selectedSent.to) : ""}</div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {sentDetail.isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading email...</div>
                ) : sentDetail.error ? (
                  <p className="text-sm text-destructive">
                    {(sentDetail.error as { message?: string })?.message || "Could not load this email."}
                  </p>
                ) : (
                  <EmailBody html={sentDetail.data?.html} text={sentDetail.data?.text} />
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="h-[650px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Select an email to read</p>
                <p className="text-sm mt-1">Click on an email from the list to view its contents</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminInbox;
