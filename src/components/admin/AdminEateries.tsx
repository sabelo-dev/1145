import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllEateries, setEateryStatus } from "@/services/food";
import { formatCurrency } from "@/lib/utils";
import type { Eatery } from "@/types/food";

const STATUS_BADGE: Record<Eatery["status"], string> = {
  pending: "bg-warning text-warning-foreground hover:bg-warning",
  approved: "bg-success text-success-foreground hover:bg-success",
  suspended: "bg-destructive text-destructive-foreground hover:bg-destructive",
};

/** Review eateries: approve new listings, suspend or restore existing ones. */
const AdminEateries: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: eateries, isLoading, isError } = useQuery({ queryKey: ["admin-eateries"], queryFn: fetchAllEateries, staleTime: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);

  const change = async (eatery: Eatery, status: Eatery["status"]) => {
    setBusyId(eatery.id);
    try {
      await setEateryStatus(eatery.id, status);
      await queryClient.invalidateQueries({ queryKey: ["admin-eateries"] });
      toast.success(`${eatery.name} is now ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the eatery");
    } finally {
      setBusyId(null);
    }
  };

  const pending = (eateries ?? []).filter((e) => e.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eateries</CardTitle>
        <CardDescription>
          {pending ? `${pending} waiting for review. ` : ""}Only approved eateries are listed under Food and can take orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <p role="alert" className="text-muted-foreground">Couldn't load eateries. Has the food delivery migration been applied?</p>
        ) : !eateries?.length ? (
          <p className="text-muted-foreground">No eateries have registered yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {eateries.map((eatery) => (
              <li key={eatery.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    {eatery.name}
                    <Badge className={STATUS_BADGE[eatery.status]}>{eatery.status}</Badge>
                    {eatery.status === "approved" && !eatery.accepting_orders && <Badge variant="outline">orders off</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {eatery.address}, {eatery.city}{eatery.phone ? ` · ${eatery.phone}` : ""}
                  </p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {eatery.cuisines.join(", ") || "No cuisines set"} · delivery {formatCurrency(eatery.delivery_fee)} · minimum {formatCurrency(eatery.min_order)}
                    {" · "}registered {new Date(eatery.created_at).toLocaleDateString("en-ZA")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {eatery.status !== "approved" && (
                    <Button size="sm" disabled={busyId === eatery.id} onClick={() => change(eatery, "approved")}>
                      {eatery.status === "suspended" ? "Restore" : "Approve"}
                    </Button>
                  )}
                  {eatery.status !== "suspended" && (
                    <Button size="sm" variant="outline" disabled={busyId === eatery.id} onClick={() => change(eatery, "suspended")}>
                      Suspend
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminEateries;
