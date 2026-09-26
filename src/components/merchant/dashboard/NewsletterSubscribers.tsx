import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, RefreshCw, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getNewsletterSubscribers, setNewsletterSubscriberStatus, type NewsletterSubscriber } from "@/services/newsletterService";

const csvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

export default function NewsletterSubscribers({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubscribers(await getNewsletterSubscribers(storeId));
    } catch {
      toast({ variant: "destructive", title: "Could not load subscribers", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => { void load(); }, [load]);

  const visibleSubscribers = useMemo(
    () => subscribers.filter((subscriber) => subscriber.email.includes(query.trim().toLowerCase())),
    [subscribers, query],
  );
  const activeCount = subscribers.filter((subscriber) => subscriber.status === "active").length;

  const updateStatus = async (subscriber: NewsletterSubscriber, status: "active" | "unsubscribed") => {
    try {
      await setNewsletterSubscriberStatus(subscriber.id, status);
      setSubscribers((current) => current.map((item) => item.id === subscriber.id
        ? { ...item, status, unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null }
        : item));
      toast({ title: status === "active" ? "Subscriber restored" : "Subscriber unsubscribed" });
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "Please try again." });
    }
  };

  const exportCsv = () => {
    const rows = ["Email,Status,Subscribed at", ...visibleSubscribers.map((subscriber) => [
      csvValue(subscriber.email), csvValue(subscriber.status), csvValue(subscriber.subscribed_at),
    ].join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "newsletter-subscribers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Newsletter subscribers</CardTitle>
          <CardDescription>{activeCount} active subscriber{activeCount === 1 ? "" : "s"}. Export only active contacts when sending a campaign.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!visibleSubscribers.length}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subscribers" aria-label="Search subscribers" />
        {loading ? <p className="text-sm text-muted-foreground">Loading subscribers…</p> : visibleSubscribers.length === 0 ? <p className="text-sm text-muted-foreground">No subscribers found yet.</p> : (
          <div className="divide-y rounded-md border">
            {visibleSubscribers.map((subscriber) => (
              <div key={subscriber.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{subscriber.email}</p><p className="text-xs text-muted-foreground">Subscribed {new Date(subscriber.subscribed_at).toLocaleDateString()}</p></div>
                <Badge variant={subscriber.status === "active" ? "default" : "secondary"}>{subscriber.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => void updateStatus(subscriber, subscriber.status === "active" ? "unsubscribed" : "active")}>
                  <UserX className="mr-1 h-4 w-4" /> {subscriber.status === "active" ? "Unsubscribe" : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
