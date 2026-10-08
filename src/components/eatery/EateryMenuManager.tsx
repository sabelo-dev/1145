import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteMenuItem, deleteMenuSection, fetchMenu, saveMenuItem, saveMenuSection } from "@/services/food";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem } from "@/types/food";

const NO_SECTION = "none";

type ItemDraft = { id?: string; name: string; description: string; price: string; image_url: string; section_id: string; is_available: boolean };
const emptyDraft = (sectionId: string = NO_SECTION): ItemDraft =>
  ({ name: "", description: "", price: "", image_url: "", section_id: sectionId, is_available: true });

/** Sections and items for one eatery's menu. */
const EateryMenuManager: React.FC<{ eateryId: string }> = ({ eateryId }) => {
  const queryClient = useQueryClient();
  const queryKey = ["eatery-menu", eateryId];
  const { data: menu, isLoading } = useQuery({ queryKey, queryFn: () => fetchMenu(eateryId), staleTime: 0 });
  const [newSection, setNewSection] = useState("");
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const act = async (action: () => Promise<void>, done?: string) => {
    try {
      await action();
      await refresh();
      if (done) toast.success(done);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work. Please try again.");
      return false;
    }
  };

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSection.trim();
    if (!name) return;
    if (await act(() => saveMenuSection({ eatery_id: eateryId, name, sort_order: menu?.sections.length ?? 0 }))) setNewSection("");
  };

  const edit = (item: MenuItem) => setDraft({
    id: item.id, name: item.name, description: item.description ?? "", price: String(item.price),
    image_url: item.image_url ?? "", section_id: item.section_id ?? NO_SECTION, is_available: item.is_available,
  });

  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const price = Number(draft.price);
    if (!draft.name.trim()) return setDraftError("Enter the item's name.");
    if (!(price > 0)) return setDraftError("Enter a price above R0.");
    if (draft.image_url.trim() && !/^https:\/\/\S+$/i.test(draft.image_url.trim())) return setDraftError("The image must be a full https:// link.");
    setDraftError(null);
    setSaving(true);
    const ok = await act(() => saveMenuItem({
      id: draft.id,
      eatery_id: eateryId,
      section_id: draft.section_id === NO_SECTION ? null : draft.section_id,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: Math.round(price * 100) / 100,
      image_url: draft.image_url.trim() || null,
      is_available: draft.is_available,
    }), draft.id ? "Item updated" : "Item added");
    setSaving(false);
    if (ok) setDraft(null);
  };

  if (isLoading || !menu) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const groups = [
    ...menu.sections.map((s) => ({ id: s.id, name: s.name, items: menu.items.filter((i) => i.section_id === s.id), isSection: true })),
    { id: NO_SECTION, name: "No section", items: menu.items.filter((i) => !i.section_id), isSection: false },
  ].filter((g) => g.isSection || g.items.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form onSubmit={addSection} className="flex items-end gap-2">
          <div>
            <Label htmlFor="new-section">Add a menu section</Label>
            <Input id="new-section" value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Starters, Mains, Drinks…" maxLength={60} className="mt-1.5 h-11 w-56" />
          </div>
          <Button type="submit" variant="outline" className="h-11" disabled={!newSection.trim()}>Add section</Button>
        </form>
        <Button variant="cta" className="h-11 rounded-full" onClick={() => { setDraftError(null); setDraft(emptyDraft()); }}>
          <Plus aria-hidden /> Add menu item
        </Button>
      </div>

      {menu.items.length === 0 && menu.sections.length === 0 && (
        <p className="rounded-2xl border border-border p-8 text-center text-text-secondary">
          Your menu is empty. Add sections like "Mains" and "Drinks", then add your items.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`manage-${group.id}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id={`manage-${group.id}`} className="type-title">{group.name}</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setDraftError(null); setDraft(emptyDraft(group.id)); }}><Plus aria-hidden /> Item</Button>
              {group.isSection && (
                <Button
                  variant="ghost" size="sm" aria-label={`Delete section ${group.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete the "${group.name}" section? Its items are kept and move to "No section".`)) void act(() => deleteMenuSection(group.id), "Section deleted");
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </div>
          </div>
          {group.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">No items in this section yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {group.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-sm tabular-nums text-text-secondary">{formatCurrency(item.price)}{item.description ? ` · ${item.description}` : ""}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-text-secondary">
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={(checked) => void act(() => saveMenuItem({ ...item, is_available: checked }))}
                      aria-label={`${item.name} available`}
                    />
                    {item.is_available ? "Available" : "Sold out"}
                  </label>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${item.name}`} onClick={() => { setDraftError(null); edit(item); }}><Pencil aria-hidden /></Button>
                  <Button
                    variant="ghost" size="icon" aria-label={`Delete ${item.name}`}
                    onClick={() => { if (window.confirm(`Delete "${item.name}" from your menu?`)) void act(() => deleteMenuItem(item.id), "Item deleted"); }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit menu item" : "Add a menu item"}</DialogTitle>
            <DialogDescription>Customers see the name, description, price and photo.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={saveDraft} noValidate className="space-y-4">
              <div>
                <Label htmlFor="item-name">Name</Label>
                <Input id="item-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} className="mt-1.5 h-11" />
              </div>
              <div>
                <Label htmlFor="item-description">Description (optional)</Label>
                <Textarea id="item-description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={300} className="mt-1.5" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="item-price">Price (R)</Label>
                  <Input id="item-price" type="number" inputMode="decimal" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor="item-section">Section</Label>
                  <Select value={draft.section_id} onValueChange={(value) => setDraft({ ...draft, section_id: value })}>
                    <SelectTrigger id="item-section" className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SECTION}>No section</SelectItem>
                      {menu.sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="item-image">Photo link (optional)</Label>
                <Input id="item-image" type="url" inputMode="url" placeholder="https://…" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} className="mt-1.5 h-11" />
              </div>
              {draftError && <p role="alert" className="text-sm text-destructive">{draftError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                <Button type="submit" variant="cta" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden />} Save item</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EateryMenuManager;
