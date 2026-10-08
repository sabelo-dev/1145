import React, { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderPrivateInput, ProviderProfileInput } from "@/services/serviceMarketplace";
import type { PortfolioItem, ServiceMode, ServiceProvider } from "@/types/services";

interface ProviderProfileFormProps {
  profile: ServiceProvider | null;
  contact: ProviderPrivateInput;
  defaultEmail?: string;
  onSave: (profile: ProviderProfileInput, contact: ProviderPrivateInput) => Promise<void>;
}

const MODES: { value: ServiceMode; label: string }[] = [
  { value: "remote", label: "Remote only" },
  { value: "in_person", label: "In person only" },
  { value: "both", label: "Remote and in person" },
];

/** The provider's public profile plus private contact details for 1145. */
const ProviderProfileForm: React.FC<ProviderProfileFormProps> = ({ profile, contact, defaultEmail, onSave }) => {
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [mode, setMode] = useState<ServiceMode>(profile?.service_mode ?? "remote");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(profile?.portfolio ?? []);
  const [rights, setRights] = useState(profile?.portfolio_rights_confirmed ?? false);
  const [email, setEmail] = useState(contact.contact_email ?? defaultEmail ?? "");
  const [phone, setPhone] = useState(contact.contact_phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const items = portfolio.map((p) => ({ title: p.title.trim(), url: p.url.trim() })).filter((p) => p.title || p.url);
    if (name.trim().length < 2) return setError("Enter your display or business name.");
    if (!bio.trim()) return setError("Add a short bio so customers know what you do.");
    if (items.some((p) => !p.title || !/^https:\/\/\S+$/i.test(p.url))) return setError("Each portfolio sample needs a title and a full https:// link.");
    if (items.length > 0 && !rights) return setError("Confirm you have the right to show your portfolio samples.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid contact email.");
    setError(null);
    setSaving(true);
    try {
      await onSave(
        { display_name: name.trim(), bio: bio.trim(), location: location.trim() || null, service_mode: mode, portfolio: items, portfolio_rights_confirmed: items.length > 0 && rights },
        { contact_email: email.trim() || null, contact_phone: phone.trim() || null },
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset>
        <legend className="type-title">Public profile</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="provider-name">Display or business name</Label>
            <Input id="provider-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="organization" className="mt-1.5 h-11" />
          </div>
          <div>
            <Label htmlFor="provider-location">Location (optional)</Label>
            <Input id="provider-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="City, province" className="mt-1.5 h-11" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="provider-bio">Short bio: what you do and your experience</Label>
            <Textarea id="provider-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1200} className="mt-1.5" />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-foreground">How you work</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {MODES.map((m) => (
                <label key={m.value} className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="service-mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="h-4 w-4 accent-[hsl(var(--brand))]" />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-title">Portfolio samples (optional)</legend>
        <p className="mt-1 text-sm text-text-secondary">Links to work you're allowed to show publicly. Up to six.</p>
        <ul className="mt-4 space-y-3">
          {portfolio.map((item, index) => (
            <li key={index} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <Input aria-label={`Sample ${index + 1} title`} placeholder="Title" value={item.title} maxLength={80} className="h-11"
                onChange={(e) => setPortfolio(portfolio.map((p, i) => (i === index ? { ...p, title: e.target.value } : p)))} />
              <Input aria-label={`Sample ${index + 1} link`} placeholder="https://…" type="url" inputMode="url" value={item.url} className="h-11"
                onChange={(e) => setPortfolio(portfolio.map((p, i) => (i === index ? { ...p, url: e.target.value } : p)))} />
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove sample ${index + 1}`} onClick={() => setPortfolio(portfolio.filter((_, i) => i !== index))}><Trash2 aria-hidden /></Button>
            </li>
          ))}
        </ul>
        {portfolio.length < 6 && (
          <Button type="button" variant="outline" className="mt-3" onClick={() => setPortfolio([...portfolio, { title: "", url: "" }])}><Plus aria-hidden /> Add a sample</Button>
        )}
        {portfolio.length > 0 && (
          <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
            <Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />
            I own this work or have permission to show it, and I agree to it being displayed publicly on 1145.
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend className="type-title">Contact details for 1145</legend>
        <p className="mt-1 text-sm text-text-secondary">Used by 1145 to reach you. Never shown to customers — they message you through the order.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="provider-email">Contact email</Label>
            <Input id="provider-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" />
          </div>
          <div>
            <Label htmlFor="provider-phone">Phone (optional)</Label>
            <Input id="provider-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-11" />
          </div>
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-4">
        <Button type="submit" variant="cta" size="lg" className="rounded-full" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden />} Save profile</Button>
        {saved && <p role="status" className="text-sm text-success">Saved</p>}
      </div>
    </form>
  );
};

export default ProviderProfileForm;
