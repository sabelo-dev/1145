import React, { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseMinor, type ListingInput, type PackageInput } from "@/services/serviceMarketplace";
import type { BriefField, ServiceCategory, ServiceListing } from "@/types/services";

interface ListingEditorProps {
  listing: ServiceListing | null;
  categories: ServiceCategory[];
  onSave: (listing: ListingInput, packages: PackageInput[]) => Promise<void>;
  onCancel: () => void;
}

type PackageDraft = { id?: string; name: string; description: string; price: string; days: string; revisions: string; deliverables: string };
type QuestionDraft = { key: string; label: string; long: boolean; required: boolean };

const toPackageDraft = (listing: ServiceListing | null): PackageDraft[] => {
  const existing = (listing?.packages ?? []).filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order);
  if (!existing.length) return [{ name: "Standard", description: "", price: "", days: "", revisions: "1", deliverables: "" }];
  return existing.map((p) => ({
    id: p.id, name: p.name, description: p.description ?? "", price: (p.price_minor / 100).toFixed(2),
    days: String(p.delivery_days), revisions: String(p.revisions_included), deliverables: p.deliverables,
  }));
};
const newKey = () => `q_${Math.random().toString(36).slice(2, 10)}`;

/** Create or edit a listing: what it is, its packages, and what the customer must provide. */
const ListingEditor: React.FC<ListingEditorProps> = ({ listing, categories, onSave, onCancel }) => {
  const [title, setTitle] = useState(listing?.title ?? "");
  const [summary, setSummary] = useState(listing?.summary ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [exclusions, setExclusions] = useState(listing?.exclusions ?? "");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(listing?.image_url ?? "");
  const [packages, setPackages] = useState<PackageDraft[]>(() => toPackageDraft(listing));
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    () => (listing?.required_brief_schema ?? []).map((f: BriefField) => ({ key: f.key, label: f.label, long: f.type === "textarea", required: f.required })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const live = listing?.status === "published" || listing?.status === "paused";
  const setPackage = (index: number, changes: Partial<PackageDraft>) => setPackages(packages.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  const setQuestion = (index: number, changes: Partial<QuestionDraft>) => setQuestions(questions.map((q, i) => (i === index ? { ...q, ...changes } : q)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 4) return setError("Give the service a clear title (at least 4 characters).");
    if (imageUrl.trim() && !/^https:\/\/\S+$/i.test(imageUrl.trim())) return setError("The cover image must be a full https:// link.");
    const cleanPackages: PackageInput[] = [];
    for (const [i, p] of packages.entries()) {
      const label = `Package ${i + 1}`;
      const price = parseMinor(p.price);
      const days = Number(p.days);
      const revisions = Number(p.revisions);
      if (!p.name.trim()) return setError(`${label}: add a name.`);
      if (price === null || price < 100) return setError(`${label}: enter a price of at least R1.00, e.g. 1499 or 1499.00.`);
      if (!Number.isInteger(days) || days < 1 || days > 365) return setError(`${label}: delivery time must be 1 to 365 days.`);
      if (!Number.isInteger(revisions) || revisions < 0 || revisions > 20) return setError(`${label}: included revisions must be 0 to 20.`);
      if (p.deliverables.trim().length < 3) return setError(`${label}: list what the customer receives.`);
      cleanPackages.push({ id: p.id, name: p.name.trim(), description: p.description.trim() || null, price_minor: price, delivery_days: days, revisions_included: revisions, deliverables: p.deliverables.trim() });
    }
    if (questions.some((q) => !q.label.trim())) return setError("Every brief question needs wording, or remove it.");
    setError(null);
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(), summary: summary.trim() || null, description: description.trim() || null, exclusions: exclusions.trim() || null,
          category_id: categoryId || null, image_url: imageUrl.trim() || null,
          required_brief_schema: questions.map((q) => ({ key: q.key, label: q.label.trim(), type: q.long ? "textarea" : "text", required: q.required })),
        },
        cleanPackages,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save the listing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {live && (
        <p role="status" className="rounded-2xl bg-surface-muted p-4 text-sm text-foreground">
          This listing is live. Changing the title, description, exclusions, category, packages or brief questions sends it back to 1145 for review and takes it off the catalog until it's approved. Existing orders are not affected.
        </p>
      )}

      <fieldset>
        <legend className="type-title">The service</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="listing-title">Title: the outcome the customer gets</Label>
            <Input id="listing-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="I will design a logo for your business" className="mt-1.5 h-11" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="listing-summary">One-line summary</Label>
            <Input id="listing-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} className="mt-1.5 h-11" />
          </div>
          <div>
            <Label htmlFor="listing-category">Category</Label>
            <select id="listing-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground focus:border-foreground focus:outline-none">
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="listing-image">Cover image link (optional)</Label>
            <Input id="listing-image" type="url" inputMode="url" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="mt-1.5 h-11" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="listing-description">Full description: how you work and what the customer can expect</Label>
            <Textarea id="listing-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={5000} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="listing-exclusions">What is not included (optional, but it prevents disputes)</Label>
            <Textarea id="listing-exclusions" value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={3} maxLength={1500} className="mt-1.5" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-title">Packages</legend>
        <p className="mt-1 text-sm text-text-secondary">Each package is a fixed price for a fixed scope. Customers buy exactly what is written here.</p>
        <ul className="mt-4 space-y-4">
          {packages.map((p, i) => (
            <li key={i} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-foreground">Package {i + 1}</p>
                {packages.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setPackages(packages.filter((_, n) => n !== i))}><Trash2 aria-hidden /> Remove</Button>}
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label htmlFor={`pkg-name-${i}`}>Name</Label>
                  <Input id={`pkg-name-${i}`} value={p.name} onChange={(e) => setPackage(i, { name: e.target.value })} maxLength={60} className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor={`pkg-price-${i}`}>Price (R)</Label>
                  <Input id={`pkg-price-${i}`} inputMode="decimal" value={p.price} onChange={(e) => setPackage(i, { price: e.target.value })} placeholder="1499.00" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor={`pkg-days-${i}`}>Delivery (days)</Label>
                  <Input id={`pkg-days-${i}`} type="number" inputMode="numeric" min={1} max={365} value={p.days} onChange={(e) => setPackage(i, { days: e.target.value })} className="mt-1.5 h-11" />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor={`pkg-deliverables-${i}`}>What the customer receives</Label>
                  <Textarea id={`pkg-deliverables-${i}`} value={p.deliverables} onChange={(e) => setPackage(i, { deliverables: e.target.value })} rows={2} maxLength={1500} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor={`pkg-revisions-${i}`}>Revisions included</Label>
                  <Input id={`pkg-revisions-${i}`} type="number" inputMode="numeric" min={0} max={20} value={p.revisions} onChange={(e) => setPackage(i, { revisions: e.target.value })} className="mt-1.5 h-11" />
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor={`pkg-description-${i}`}>Short description (optional)</Label>
                  <Input id={`pkg-description-${i}`} value={p.description} onChange={(e) => setPackage(i, { description: e.target.value })} maxLength={600} className="mt-1.5 h-11" />
                </div>
              </div>
            </li>
          ))}
        </ul>
        {packages.length < 3 && (
          <Button type="button" variant="outline" className="mt-3" onClick={() => setPackages([...packages, { name: "", description: "", price: "", days: "", revisions: "1", deliverables: "" }])}>
            <Plus aria-hidden /> Add a package
          </Button>
        )}
      </fieldset>

      <fieldset>
        <legend className="type-title">Brief questions</legend>
        <p className="mt-1 text-sm text-text-secondary">What you need from the customer before you can start. They answer right after paying; the delivery time starts once required answers are in.</p>
        <ul className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={q.key} className="rounded-2xl border border-border p-4">
              <Label htmlFor={`question-${q.key}`}>Question {i + 1}</Label>
              <Input id={`question-${q.key}`} value={q.label} onChange={(e) => setQuestion(i, { label: e.target.value })} maxLength={120} placeholder="What is your business name?" className="mt-1.5 h-11" />
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={q.required} onCheckedChange={(v) => setQuestion(i, { required: v === true })} /> Required</label>
                <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={q.long} onCheckedChange={(v) => setQuestion(i, { long: v === true })} /> Long answer</label>
                <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setQuestions(questions.filter((_, n) => n !== i))}><Trash2 aria-hidden /> Remove</Button>
              </div>
            </li>
          ))}
        </ul>
        {questions.length < 12 && (
          <Button type="button" variant="outline" className="mt-3" onClick={() => setQuestions([...questions, { key: newKey(), label: "", long: false, required: true }])}>
            <Plus aria-hidden /> Add a question
          </Button>
        )}
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="cta" size="lg" className="rounded-full" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden />} Save listing</Button>
        <Button type="button" variant="ghost" size="lg" className="rounded-full" disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

export default ListingEditor;
