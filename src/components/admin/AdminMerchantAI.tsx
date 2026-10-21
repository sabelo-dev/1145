import React, { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isNotInstalled, setMerchantFeature, toMerchantAiError, type MerchantFeature } from "@/services/merchantAi";
import MerchantAIPilotMetrics from "./MerchantAIPilotMetrics";

const db = supabase as unknown as SupabaseClient;

const FEATURES: Array<{ key: MerchantFeature; label: string }> = [
  { key: "order_console", label: "Order console" },
  { key: "payment_requests", label: "1145 Pay" },
  { key: "ai_assistant", label: "1145 AI" },
];

interface FlagRow { merchant_id: string; flag_key: MerchantFeature; enabled: boolean; rollout_cohort: string | null }
interface UsageRow { store_id: string; usage_date: string; requests: number; input_tokens: number; output_tokens: number }

/**
 * Turns Merchant AI features on per merchant (everything starts off) and shows
 * the assistant's use, for the Mbombela pilot and later cohorts.
 */
const AdminMerchantAI: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("mbombela-pilot");

  const merchants = useQuery({
    queryKey: ["admin-merchant-ai-merchants"],
    queryFn: async () => {
      const { data, error } = await db.from("merchants").select("id, business_name, status").order("business_name");
      if (error) throw new Error(error.message);
      return data as Array<{ id: string; business_name: string; status: string }>;
    },
  });

  const flags = useQuery({
    queryKey: ["admin-merchant-ai-flags"],
    retry: (count, error) => !isNotInstalled(error) && count < 2,
    queryFn: async () => {
      const { data, error } = await db.from("merchant_feature_flags").select("merchant_id, flag_key, enabled, rollout_cohort");
      if (error) throw toMerchantAiError(error);
      return data as FlagRow[];
    },
  });

  const usage = useQuery({
    queryKey: ["admin-merchant-ai-usage"],
    retry: (count, error) => !isNotInstalled(error) && count < 2,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await db.from("merchant_ai_usage").select("*").gte("usage_date", since);
      if (error) throw toMerchantAiError(error);
      return data as UsageRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: ({ merchantId, flag, enabled }: { merchantId: string; flag: MerchantFeature; enabled: boolean }) =>
      setMerchantFeature(merchantId, flag, enabled, enabled ? cohort.trim() || undefined : undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-merchant-ai-flags"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const enabledMap = useMemo(() => {
    const map = new Map<string, FlagRow>();
    for (const f of flags.data ?? []) map.set(`${f.merchant_id}:${f.flag_key}`, f);
    return map;
  }, [flags.data]);

  const totals = useMemo(() => (usage.data ?? []).reduce(
    (t, u) => ({ requests: t.requests + u.requests, input: t.input + Number(u.input_tokens), output: t.output + Number(u.output_tokens) }),
    { requests: 0, input: 0, output: 0 },
  ), [usage.data]);

  const shown = (merchants.data ?? []).filter((m) => m.business_name.toLowerCase().includes(search.toLowerCase()));

  if (isNotInstalled(flags.error) || isNotInstalled(usage.error)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Merchant AI is not installed on this database</CardTitle>
          <CardDescription>
            The 20261021 Merchant AI migrations have not been applied to the Supabase project this app is connected to.
            Apply them (staging first, see docs/merchant-ai/README.md), and this page will show feature switches and
            pilot measurement. Merchants see no Merchant AI features until then.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Merchants with any feature on</CardDescription>
          <CardTitle>{new Set((flags.data ?? []).filter((f) => f.enabled).map((f) => f.merchant_id)).size}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>AI questions, last 30 days</CardDescription>
          <CardTitle>{totals.requests.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>AI tokens, last 30 days (in / out)</CardDescription>
          <CardTitle className="text-xl">{totals.input.toLocaleString()} / {totals.output.toLocaleString()}</CardTitle></CardHeader></Card>
      </div>

      <MerchantAIPilotMetrics cohort={cohort} />

      <Card>
        <CardHeader>
          <CardTitle>Merchant AI features</CardTitle>
          <CardDescription>
            New features are off for every merchant until switched on here. Merchants and their staff see a feature on
            their next page load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search merchants" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Input placeholder="Cohort label" value={cohort} onChange={(e) => setCohort(e.target.value)} className="max-w-xs"
              aria-label="Cohort recorded when switching a feature on" />
          </div>
          {(merchants.isLoading || flags.isLoading) ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  {FEATURES.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                  <TableHead>Cohort</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((m) => {
                  const cohorts = new Set(FEATURES.map((f) => enabledMap.get(`${m.id}:${f.key}`)?.rollout_cohort).filter(Boolean));
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        {m.business_name}
                        {m.status !== "approved" && <Badge variant="secondary" className="ml-2">{m.status}</Badge>}
                      </TableCell>
                      {FEATURES.map((f) => (
                        <TableCell key={f.key}>
                          <Switch
                            checked={!!enabledMap.get(`${m.id}:${f.key}`)?.enabled}
                            disabled={toggle.isPending}
                            onCheckedChange={(enabled) => toggle.mutate({ merchantId: m.id, flag: f.key, enabled })}
                            aria-label={`${f.label} for ${m.business_name}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-muted-foreground">{[...cohorts].join(", ")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMerchantAI;
