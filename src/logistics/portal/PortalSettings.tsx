import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "../lib/db";
import { PageHeader } from "../components/common";
import { usePortal } from "./PortalApp";

interface Settings {
  brand_name: string;
  brand_logo_url: string;
  brand_color: string;
  support_phone: string;
  support_email: string;
  tracking_message: string;
  ops_email: string;
  billing_email: string;
  digest_enabled: boolean;
}

const EMPTY: Settings = {
  brand_name: "",
  brand_logo_url: "",
  brand_color: "#1e3a5f",
  support_phone: "",
  support_email: "",
  tracking_message: "",
  ops_email: "",
  billing_email: "",
  digest_enabled: true,
};

const PortalSettings: React.FC = () => {
  const { account } = usePortal();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["portal", account.id, "settings"],
    queryFn: async () =>
      (await db
        .from("logistics_accounts")
        .select("brand_name, brand_logo_url, brand_color, support_phone, support_email, tracking_message, ops_email, billing_email, digest_enabled")
        .eq("id", account.id)
        .maybeSingle()).data as Partial<Settings> | null,
  });
  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? (k === "brand_color" ? "#1e3a5f" : "")])) } as Settings);
  }, [data]);

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const logoOk = !form.brand_logo_url || /^https:\/\/\S{4,500}$/.test(form.brand_logo_url);
  const colorOk = /^#[0-9a-fA-F]{6}$/.test(form.brand_color);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await db.rpc("portal_update_account_settings", { p_account_id: account.id, p_settings: form });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Not saved", description: error.message });
      return;
    }
    toast({ title: "Settings saved" });
    qc.invalidateQueries({ queryKey: ["portal", account.id] });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="How your customers see their deliveries, and where we send operational emails." />
      <form onSubmit={save} className="space-y-6">
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Branded tracking page</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand name</Label>
              <Input value={form.brand_name} onChange={set("brand_name")} placeholder={account.name} />
            </div>
            <div className="space-y-1.5">
              <Label>Brand colour</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={colorOk ? form.brand_color : "#1e3a5f"}
                  onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                  className="h-10 w-12 rounded border bg-background"
                  aria-label="Pick colour"
                />
                <Input value={form.brand_color} onChange={set("brand_color")} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Logo URL (https)</Label>
              <Input value={form.brand_logo_url} onChange={set("brand_logo_url")} placeholder="https://yourstore.com/logo.png" />
              {!logoOk && <p className="text-xs text-destructive">Use an https:// image URL.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Customer support phone</Label>
              <Input type="tel" value={form.support_phone} onChange={set("support_phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Customer support email</Label>
              <Input type="email" value={form.support_email} onChange={set("support_email")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Message on the tracking page</Label>
              <Textarea rows={2} maxLength={240} value={form.tracking_message} onChange={set("tracking_message")} placeholder="Thanks for shopping with us! Questions? WhatsApp us any time." />
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden" aria-label="Preview">
            <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: colorOk ? form.brand_color : "#1e3a5f" }}>
              {form.brand_logo_url && logoOk && <img src={form.brand_logo_url} alt="" className="h-7 w-auto max-w-[120px] rounded bg-white/90 p-0.5 object-contain" />}
              <span className="font-semibold">{form.brand_name || account.name}</span>
              <span className="ml-auto text-xs opacity-80">delivered by 1145 Logistics</span>
            </div>
            {form.tracking_message && <p className="px-4 py-2 text-sm">{form.tracking_message}</p>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Operations email</Label>
              <Input type="email" value={form.ops_email} onChange={set("ops_email")} placeholder="ops@yourstore.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Billing email</Label>
              <Input type="email" value={form.billing_email} onChange={set("billing_email")} />
            </div>
          </div>
          <label className="flex items-start gap-3">
            <Switch checked={form.digest_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, digest_enabled: v }))} />
            <span>
              <span className="text-sm font-medium block">Daily exceptions email</span>
              <span className="text-xs text-muted-foreground">Each morning: parcels that were missed, had a problem, are returning, or are at risk of being late. Only sent when there's something to act on.</span>
            </span>
          </label>
        </section>

        <Button type="submit" disabled={saving || !logoOk || !colorOk}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  );
};

export default PortalSettings;
