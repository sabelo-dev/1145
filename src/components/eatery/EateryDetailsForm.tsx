import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EateryDetails } from "@/services/food";
import type { Eatery } from "@/types/food";

interface EateryDetailsFormProps {
  /** Existing eatery when editing; omit to register a new one. */
  eatery?: Eatery;
  submitLabel: string;
  onSubmit: (details: EateryDetails) => Promise<void>;
}

type Draft = {
  name: string; description: string; cuisines: string; logo_url: string; cover_url: string; phone: string;
  address: string; city: string; province: string; opening_hours: string; prep_time_min: string; delivery_fee: string; min_order: string;
};

const toDraft = (e?: Eatery): Draft => ({
  name: e?.name ?? "", description: e?.description ?? "", cuisines: e?.cuisines.join(", ") ?? "",
  logo_url: e?.logo_url ?? "", cover_url: e?.cover_url ?? "", phone: e?.phone ?? "",
  address: e?.address ?? "", city: e?.city ?? "", province: e?.province ?? "", opening_hours: e?.opening_hours ?? "",
  prep_time_min: String(e?.prep_time_min ?? 20), delivery_fee: String(e?.delivery_fee ?? 0), min_order: String(e?.min_order ?? 0),
});

const isUrl = (value: string) => /^https:\/\/\S+$/i.test(value);

/** Register or edit an eatery's listing: who you are, where you are and how delivery is priced. */
const EateryDetailsForm: React.FC<EateryDetailsFormProps> = ({ eatery, submitLabel, onSubmit }) => {
  const [draft, setDraft] = useState<Draft>(() => toDraft(eatery));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof Draft, string>> = {};
    if (draft.name.trim().length < 2) next.name = "Enter the eatery's name";
    if (!draft.address.trim()) next.address = "Enter the street address drivers collect from";
    if (!draft.city.trim()) next.city = "Enter the city or suburb";
    if (draft.phone.replace(/\D/g, "").length < 9) next.phone = "Enter a phone number customers and drivers can call";
    const prep = Number(draft.prep_time_min);
    if (!Number.isInteger(prep) || prep < 5 || prep > 180) next.prep_time_min = "Enter minutes between 5 and 180";
    const fee = Number(draft.delivery_fee);
    if (draft.delivery_fee.trim() === "" || Number.isNaN(fee) || fee < 0) next.delivery_fee = "Enter 0 or more";
    const min = Number(draft.min_order);
    if (draft.min_order.trim() === "" || Number.isNaN(min) || min < 0) next.min_order = "Enter 0 or more";
    for (const key of ["logo_url", "cover_url"] as const) {
      if (draft[key].trim() && !isUrl(draft[key].trim())) next[key] = "Enter a full https:// image link";
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) { document.getElementById(`eatery-${first}`)?.focus(); return; }

    setSaving(true);
    setFailure(null);
    try {
      await onSubmit({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        cuisines: [...new Set(draft.cuisines.split(",").map((c) => c.trim()).filter(Boolean))].slice(0, 6),
        logo_url: draft.logo_url.trim() || null,
        cover_url: draft.cover_url.trim() || null,
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        city: draft.city.trim(),
        province: draft.province.trim() || null,
        opening_hours: draft.opening_hours.trim() || null,
        prep_time_min: prep,
        delivery_fee: Math.round(fee * 100) / 100,
        min_order: Math.round(min * 100) / 100,
      });
      setSaved(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "We couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const input = (key: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string, wide = false) => (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`eatery-${key}`}>{label}</Label>
      <Input
        id={`eatery-${key}`} value={draft[key]} onChange={set(key)} className="mt-1.5 h-11"
        aria-invalid={!!errors[key]}
        aria-describedby={[errors[key] && `eatery-${key}-error`, hint && `eatery-${key}-hint`].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {hint && !errors[key] && <p id={`eatery-${key}-hint`} className="mt-1 text-xs text-text-secondary">{hint}</p>}
      {errors[key] && <p id={`eatery-${key}-error`} className="mt-1 text-sm text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset>
        <legend className="type-title">About the eatery</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {input("name", "Eatery name", { autoComplete: "organization", maxLength: 80 })}
          {input("cuisines", "Cuisines", { placeholder: "Burgers, Grill, Vegetarian" }, "Separate with commas. Up to six.")}
          <div className="sm:col-span-2">
            <Label htmlFor="eatery-description">Short description (optional)</Label>
            <Textarea id="eatery-description" value={draft.description} onChange={set("description")} rows={3} maxLength={400} className="mt-1.5" />
          </div>
          {input("phone", "Phone number", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
          {input("opening_hours", "Opening hours (optional)", { placeholder: "Mon–Sat 10:00–21:00" }, "Shown to customers as written.")}
          {input("logo_url", "Logo image link (optional)", { type: "url", inputMode: "url", placeholder: "https://…" })}
          {input("cover_url", "Cover photo link (optional)", { type: "url", inputMode: "url", placeholder: "https://…" }, "A wide photo of your food or shopfront.")}
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-title">Where drivers collect</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {input("address", "Street address", { autoComplete: "street-address" }, undefined, true)}
          {input("city", "City or suburb", { autoComplete: "address-level2" })}
          {input("province", "Province (optional)", { autoComplete: "address-level1" })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-title">Orders and delivery</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {input("prep_time_min", "Typical prep time (minutes)", { type: "number", inputMode: "numeric", min: 5, max: 180, step: 1 })}
          {input("delivery_fee", "Delivery fee (R)", { type: "number", inputMode: "decimal", min: 0, step: "0.01" }, "A flat fee added to every order.")}
          {input("min_order", "Minimum order (R)", { type: "number", inputMode: "decimal", min: 0, step: "0.01" }, "Use 0 for no minimum.")}
        </div>
      </fieldset>

      {failure && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" variant="cta" size="lg" className="rounded-full" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />} {submitLabel}
        </Button>
        {saved && <p role="status" className="text-sm text-success">Saved</p>}
      </div>
    </form>
  );
};

export default EateryDetailsForm;
