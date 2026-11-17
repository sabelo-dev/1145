import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db, ROLE_LABELS, type LogisticsRole } from "../lib/db";
import { useHubs } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { PageHeader } from "../components/common";

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: LogisticsRole;
  hub_id: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_HELP: Record<LogisticsRole, string> = {
  owner: "Everything, including team and hubs",
  dispatcher: "Shipments, routes, dispatch",
  fleet_manager: "Vehicles, fleets and hubs",
  hub_operator: "Book and scan shipments",
  viewer: "Read-only",
};

const TeamPage: React.FC = () => {
  const { can, session } = useLogisticsAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LogisticsRole>("dispatcher");
  const [saving, setSaving] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["lx", "members"],
    enabled: can("owner"),
    queryFn: async () => {
      const { data, error } = await db.rpc("logistics_list_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  if (!can("owner")) return <Navigate to="/" replace />;

  const upsert = async (memberEmail: string, memberRole: LogisticsRole, hubId: string | null) => {
    const { error } = await db.rpc("logistics_upsert_member", { p_email: memberEmail, p_role: memberRole, p_hub_id: hubId });
    if (error) {
      toast({
        variant: "destructive",
        title: "Could not save member",
        description: error.message.includes("user_not_found") ? "No 1145 account uses that email. Ask them to sign up first." : error.message,
      });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["lx", "members"] });
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (await upsert(email.trim(), role, null)) {
      toast({ title: "Member added", description: `${email} is now a ${ROLE_LABELS[role].toLowerCase()}.` });
      setEmail("");
    }
    setSaving(false);
  };

  const setActive = async (m: Member, active: boolean) => {
    const { error } = await db.from("logistics_members").update({ is_active: active }).eq("id", m.id);
    if (error) toast({ variant: "destructive", title: "Update failed", description: error.message });
    qc.invalidateQueries({ queryKey: ["lx", "members"] });
  };

  return (
    <div>
      <PageHeader title="Team" description="Who can use 1145 Logistics, and what they can do. Platform admins are always owners." />

      <form onSubmit={add} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row gap-2 mb-4">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com (existing 1145 account)" className="flex-1" />
        <Select value={role} onValueChange={(v) => setRole(v as LogisticsRole)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={saving}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </form>
      <p className="text-xs text-muted-foreground -mt-2 mb-4">{ROLE_HELP[role]}</p>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Home hub</TableHead>
              <TableHead className="hidden md:table-cell">Added</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No members yet. Platform admins have owner access automatically.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => {
              const self = m.user_id === session?.user.id;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.email}
                    {self && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={m.role} disabled={self} onValueChange={(v) => upsert(m.email, v as LogisticsRole, m.hub_id)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Select value={m.hub_id ?? "none"} onValueChange={(v) => upsert(m.email, m.role, v === "none" ? null : v)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Any</SelectItem>
                        {hubs.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(m.created_at), "d MMM yyyy")}</TableCell>
                  <TableCell>
                    <Switch checked={m.is_active} disabled={self} onCheckedChange={(v) => setActive(m, v)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TeamPage;
