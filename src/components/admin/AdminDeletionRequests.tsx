import { useCallback, useEffect, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeletionRequest {
  id: string;
  user_id: string;
  email: string | null;
  reason: string | null;
  status: "pending" | "completed" | "cancelled";
  requested_at: string;
  completed_at: string | null;
}

// account_deletion_requests is not in the generated types yet.
const requests = () =>
  (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)("account_deletion_requests");

/**
 * Account deletion requests from Settings / Profile (App Store / Play
 * requirement). Complete each within 30 days: delete the user in Supabase
 * (Authentication → Users) once any records you must keep are handled, then
 * mark the request completed here.
 */
export default function AdminDeletionRequests() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await requests().select("*").order("requested_at", { ascending: true });
    if (error) toast({ variant: "destructive", title: "Could not load requests", description: error.message });
    setRows((data ?? []) as unknown as DeletionRequest[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (row: DeletionRequest, status: "completed" | "cancelled") => {
    setBusy(row.id);
    const { error } = await requests()
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null } as never)
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
      return;
    }
    toast({ title: status === "completed" ? "Marked as deleted" : "Request cancelled" });
    load();
  };

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account deletion requests</CardTitle>
        <CardDescription>
          Users asked to delete their account. Complete each within 30 days: delete the user in Supabase
          (Authentication → Users) after keeping any records the law requires (orders, payments), then mark it
          completed. {pending.length} pending.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No deletion requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const daysLeft = 30 - differenceInCalendarDays(new Date(), new Date(r.requested_at));
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.email ?? "—"}
                        <div className="text-xs text-muted-foreground font-mono">{r.user_id}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(r.requested_at), "d MMM yyyy")}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.status === "pending" ? (
                          <span className={daysLeft <= 5 ? "text-destructive font-medium" : ""}>
                            {daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days overdue`}
                          </span>
                        ) : r.completed_at ? format(new Date(r.completed_at), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{r.reason || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "pending" ? "destructive" : "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => setStatus(r, "completed")} disabled={busy === r.id}>
                              <Check className="h-4 w-4 mr-1" /> Deleted
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setStatus(r, "cancelled")} disabled={busy === r.id}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
