import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { useLogisticsAuth } from "../auth/LogisticsAuth";

/** Account team: used by the portal (account admins) and the console (owners). */
const AccountTeam: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { session } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const { data: members = [] } = useQuery({
    queryKey: ["account-members", accountId],
    queryFn: async () => {
      const { data, error } = await db.rpc("logistics_list_account_members", { p_account_id: accountId });
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; email: string; role: "admin" | "user"; created_at: string }>;
    },
  });

  const setMember = async (memberEmail: string, memberRole: "admin" | "user" | "remove") => {
    const { error } = await db.rpc("logistics_set_account_member", { p_account_id: accountId, p_email: memberEmail, p_role: memberRole });
    if (error) {
      toast({
        variant: "destructive",
        title: "Not saved",
        description: error.message.includes("user_not_found")
          ? "No 1145 account uses that email. Ask them to sign up first."
          : error.message.includes("cannot_remove_self")
            ? "You can't remove yourself."
            : error.message,
      });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["account-members", accountId] });
    return true;
  };

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await setMember(email.trim(), role)) {
            toast({ title: "Added", description: email });
            setEmail("");
          }
        }}
      >
        <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com (existing 1145 login)" className="flex-1" />
        <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="user">User: book & track</option>
          <option value="admin">Admin: + invoices, API, team</option>
        </select>
        <Button type="submit">
          <UserPlus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </form>
      <ul className="divide-y rounded-lg border">
        {members.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No users yet.</li>}
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1 truncate">
              {m.email}
              {m.user_id === session?.user.id && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <select
              value={m.role}
              disabled={m.user_id === session?.user.id}
              onChange={(e) => setMember(m.email, e.target.value as "admin" | "user")}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <span className="text-xs text-muted-foreground hidden sm:inline">since {format(new Date(m.created_at), "d MMM yyyy")}</span>
            {m.user_id !== session?.user.id && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setMember(m.email, "remove")}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AccountTeam;
