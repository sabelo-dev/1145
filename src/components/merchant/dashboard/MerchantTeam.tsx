import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import {
  canUse,
  fetchStoreMembers,
  ROLE_LABELS,
  setStoreMemberStatus,
  upsertStoreMember,
  type StoreMember,
} from "@/services/merchantAi";
import StoreSwitcher from "./StoreSwitcher";

const ROLE_HELP: Record<StoreMember["role"], string> = {
  manager: "Orders, products, payment links and insights",
  cashier: "Orders and payment links",
  catalog_editor: "Products and AI drafts",
  finance: "Payment links and insights",
};

/** The store owner adds staff with a role; staff sign in with their own 1145 account. */
const MerchantTeam: React.FC = () => {
  const { stores, current, setStoreId } = useMerchantAccess();
  const queryClient = useQueryClient();
  const storeId = current?.store_id;
  const isOwner = canUse(current, "settings");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StoreMember["role"]>("cashier");

  const members = useQuery({
    queryKey: ["store-members", storeId],
    queryFn: () => fetchStoreMembers(storeId!),
    enabled: !!storeId && isOwner,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["store-members", storeId] });

  const add = useMutation({
    mutationFn: () => upsertStoreMember(storeId!, email.trim(), role),
    onSuccess: () => {
      setEmail("");
      toast.success("Team member added. They can sign in with their own account.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StoreMember["status"] }) => setStoreMemberStatus(id, status),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  if (!current || !isOwner) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Only the store owner manages the team.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <StoreSwitcher stores={stores} current={current} onChange={setStoreId} />
      <Card>
        <CardHeader>
          <CardTitle>Add a team member</CardTitle>
          <CardDescription>
            They need a 1145 account. Staff use the order console at /merchant/console and see only what their role allows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Input type="email" required placeholder="name@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-11 min-w-[220px] flex-1" aria-label="Email" />
            <Select value={role} onValueChange={(v) => setRole(v as StoreMember["role"])}>
              <SelectTrigger className="h-11 w-48" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_HELP) as StoreMember["role"][]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" className="h-11 gap-2" disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{ROLE_LABELS[role]}: {ROLE_HELP[role]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {members.data?.length === 0 && <p className="text-sm text-muted-foreground">Just you so far.</p>}
          {members.data?.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name || m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant="outline">{ROLE_LABELS[m.role]}</Badge>
              {m.status === "suspended" && <Badge variant="secondary">Suspended</Badge>}
              <Button variant="outline" size="sm" disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: m.id, status: m.status === "active" ? "suspended" : "active" })}>
                {m.status === "active" ? "Suspend" : "Restore"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantTeam;
