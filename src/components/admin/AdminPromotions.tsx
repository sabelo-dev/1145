import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Percent, Tag, TrendingUp, Plus, Edit, Trash2, Loader2, Pause, Play, Search, CalendarClock } from "lucide-react";

type PromotionType = "percentage" | "fixed" | "free_shipping";

interface Promotion {
  id: string;
  store_id: string;
  name: string;
  code: string;
  type: PromotionType;
  value: number;
  min_order_value: number | null;
  usage_limit: number | null;
  usage_count: number | null;
  start_date: string;
  end_date: string;
  status: "active" | "paused" | "expired";
}

interface StoreOption {
  id: string;
  name: string;
}

/** What a shopper would experience right now, which the stored status alone does not say. */
type LiveState = "live" | "scheduled" | "paused" | "ended" | "used_up";

const STATE_LABEL: Record<LiveState, string> = {
  live: "Live",
  scheduled: "Scheduled",
  paused: "Paused",
  ended: "Ended",
  used_up: "Limit reached",
};

const STATE_VARIANT: Record<LiveState, "default" | "secondary" | "outline" | "destructive"> = {
  live: "default",
  scheduled: "secondary",
  paused: "outline",
  ended: "destructive",
  used_up: "destructive",
};

const ALL_STORES = "all";

const emptyForm = {
  storeId: ALL_STORES,
  name: "",
  code: "",
  type: "percentage" as PromotionType,
  value: "",
  minOrderValue: "",
  usageLimit: "",
  startDate: "",
  endDate: "",
};

const liveState = (p: Promotion): LiveState => {
  const now = Date.now();
  if (p.status === "paused") return "paused";
  if (p.status === "expired" || new Date(p.end_date).getTime() < now) return "ended";
  if (p.usage_limit != null && Number(p.usage_count ?? 0) >= p.usage_limit) return "used_up";
  if (new Date(p.start_date).getTime() > now) return "scheduled";
  return "live";
};

const describeValue = (p: Pick<Promotion, "type" | "value">) =>
  p.type === "percentage" ? `${p.value}% off` : p.type === "fixed" ? `${formatCurrency(p.value)} off` : "Free shipping";

/** yyyy-mm-dd for a date input. */
const dateInput = (iso: string) => iso.slice(0, 10);

/**
 * Promo codes across every store. A code belongs to a store and discounts that
 * store's items at checkout; a platform-wide code is the same code created for
 * each store.
 */
const AdminPromotions: React.FC = () => {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [discountGiven, setDiscountGiven] = useState(0);
  const [paidOrdersWithPromo, setPaidOrdersWithPromo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<LiveState | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Promotion | null>(null);

  const storeName = useMemo(() => new Map(stores.map(s => [s.id, s.name])), [stores]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [promoResult, storeResult, orderResult] = await Promise.all([
        supabase.from("promotions").select("*").order("created_at", { ascending: false }),
        supabase.from("stores").select("id, name").order("name"),
        // promo_discount is newer than the generated database types.
        (supabase.from("orders") as any).select("promo_discount").eq("payment_status", "paid").gt("promo_discount", 0),
      ]);
      if (promoResult.error) throw promoResult.error;
      if (storeResult.error) throw storeResult.error;

      setPromotions((promoResult.data || []) as Promotion[]);
      setStores(storeResult.data || []);
      const paid: Array<{ promo_discount: number | null }> = orderResult.data || [];
      setPaidOrdersWithPromo(paid.length);
      setDiscountGiven(paid.reduce((sum, o) => sum + Number(o.promo_discount || 0), 0));
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load promotions" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      storeId: p.store_id,
      name: p.name,
      code: p.code,
      type: p.type,
      value: p.type === "free_shipping" ? "" : String(p.value),
      minOrderValue: p.min_order_value ? String(p.min_order_value) : "",
      usageLimit: p.usage_limit != null ? String(p.usage_limit) : "",
      startDate: dateInput(p.start_date),
      endDate: dateInput(p.end_date),
    });
    setDialogOpen(true);
  };

  /** A message for the first thing wrong with the form, or null. */
  const formProblem = (): string | null => {
    const value = Number(form.value);
    if (!form.name.trim()) return "Give the promotion a name.";
    if (!/^[A-Z0-9_-]{3,30}$/.test(form.code.trim().toUpperCase())) {
      return "The code must be 3 to 30 letters, numbers, dashes or underscores.";
    }
    if (form.type !== "free_shipping" && !(value > 0)) return "Enter a discount value above zero.";
    if (form.type === "percentage" && value > 100) return "A percentage discount cannot be more than 100.";
    if (!form.startDate || !form.endDate) return "Choose a start date and an end date.";
    if (form.endDate < form.startDate) return "The end date must be on or after the start date.";
    if (form.usageLimit && !(Number(form.usageLimit) >= 1)) return "The usage limit must be at least 1, or left empty for no limit.";
    if (!editing && form.storeId === ALL_STORES && stores.length === 0) return "There are no stores to add this promotion to.";
    return null;
  };

  const save = async () => {
    const problem = formProblem();
    if (problem) {
      toast({ variant: "destructive", title: "Check the form", description: problem });
      return;
    }

    const row = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === "free_shipping" ? 0 : Number(form.value),
      min_order_value: form.minOrderValue ? Number(form.minOrderValue) : 0,
      usage_limit: form.usageLimit ? Math.floor(Number(form.usageLimit)) : null,
      // The promotion runs from the start of the first day to the end of the last.
      start_date: new Date(`${form.startDate}T00:00:00`).toISOString(),
      end_date: new Date(`${form.endDate}T23:59:59`).toISOString(),
    };

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("promotions").update(row).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Promotion updated" });
      } else {
        const storeIds = form.storeId === ALL_STORES ? stores.map(s => s.id) : [form.storeId];
        // A store that already uses this code keeps its own promotion.
        const taken = new Set(promotions.filter(p => p.code === row.code).map(p => p.store_id));
        const targets = storeIds.filter(id => !taken.has(id));
        if (targets.length === 0) {
          throw new Error(`The code ${row.code} already exists for ${storeIds.length === 1 ? "that store" : "every store"}.`);
        }
        const { error } = await supabase
          .from("promotions")
          .insert(targets.map(store_id => ({ ...row, store_id, status: "active" })));
        if (error) throw error;
        const skipped = storeIds.length - targets.length;
        toast({
          title: "Promotion created",
          description: `${row.code} added to ${targets.length} store${targets.length === 1 ? "" : "s"}${skipped ? `; ${skipped} already had this code` : ""}.`,
        });
      }
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Promotion not saved",
        description: error instanceof Error ? error.message : (error as { message?: string })?.message || "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  const setPaused = async (p: Promotion, paused: boolean) => {
    const { error } = await supabase.from("promotions").update({ status: paused ? "paused" : "active" }).eq("id", p.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: paused ? "Promotion paused" : "Promotion resumed" });
    await fetchData();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("promotions").delete().eq("id", deleting.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Promotion deleted" });
      await fetchData();
    }
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const withState = promotions.map(p => ({ promotion: p, state: liveState(p) }));
  const term = search.trim().toLowerCase();
  const visible = withState.filter(({ promotion: p, state }) =>
    (stateFilter === "all" || state === stateFilter) &&
    (!term ||
      p.code.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      (storeName.get(p.store_id) || "").toLowerCase().includes(term)));

  const liveCount = withState.filter(x => x.state === "live").length;
  const scheduledCount = withState.filter(x => x.state === "scheduled").length;
  const redemptions = promotions.reduce((sum, p) => sum + Number(p.usage_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Promotions & Discounts</h2>
          <p className="text-muted-foreground">Promo codes shoppers can enter at checkout, across every store.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Promotion
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Now</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveCount}</div>
            <p className="text-xs text-muted-foreground">of {promotions.length} promotions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledCount}</div>
            <p className="text-xs text-muted-foreground">not started yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Times Used</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{redemptions}</div>
            <p className="text-xs text-muted-foreground">across all codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discount Given</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap">{formatCurrency(discountGiven)}</div>
            <p className="text-xs text-muted-foreground">on {paidOrdersWithPromo} paid order{paidOrdersWithPromo === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Promotions</CardTitle>
          <CardDescription>
            A code discounts the items of the store it belongs to. Choose "All stores" when creating one to add the same code to every store.
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name or store..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as LiveState | "all")}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {(Object.keys(STATE_LABEL) as LiveState[]).map(state => (
                  <SelectItem key={state} value={state}>{STATE_LABEL[state]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {promotions.length === 0 ? "No promotions yet" : "No promotions match"}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {promotions.length === 0
                  ? "Create a promo code for one store or for every store."
                  : "Try a different search or state."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(({ promotion: p, state }) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-mono font-medium">{p.code}</div>
                        <div className="text-xs text-muted-foreground">{p.name}</div>
                      </TableCell>
                      <TableCell>{storeName.get(p.store_id) || "Unknown store"}</TableCell>
                      <TableCell>
                        <div>{describeValue(p)}</div>
                        {Number(p.min_order_value) > 0 && (
                          <div className="text-xs text-muted-foreground">Min. spend {formatCurrency(Number(p.min_order_value))}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {Number(p.usage_count ?? 0)}{p.usage_limit != null ? ` / ${p.usage_limit}` : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell><Badge variant={STATE_VARIANT[state]}>{STATE_LABEL[state]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(state === "live" || state === "scheduled") && (
                            <Button variant="ghost" size="icon" aria-label={`Pause ${p.code}`} onClick={() => setPaused(p, true)}>
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {state === "paused" && (
                            <Button variant="ghost" size="icon" aria-label={`Resume ${p.code}`} onClick={() => setPaused(p, false)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.code}`} onClick={() => openEdit(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${p.code}`} onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Promotion" : "New Promotion"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `For ${storeName.get(editing.store_id) || "this store"}.`
                : "Shoppers enter the code at checkout to get the discount."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Applies to</Label>
                <Select value={form.storeId} onValueChange={(storeId) => setForm(f => ({ ...f, storeId }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STORES}>All stores ({stores.length})</SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promo-name">Name</Label>
                <Input id="promo-name" placeholder="Summer sale" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-code">Code</Label>
                <Input
                  id="promo-code"
                  placeholder="SUMMER20"
                  className="font-mono uppercase"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select value={form.type} onValueChange={(type) => setForm(f => ({ ...f, type: type as PromotionType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage off</SelectItem>
                    <SelectItem value="fixed">Fixed amount off</SelectItem>
                    <SelectItem value="free_shipping">Free shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type !== "free_shipping" && (
                <div className="space-y-2">
                  <Label htmlFor="promo-value">{form.type === "percentage" ? "Percent off" : "Amount off (R)"}</Label>
                  <Input id="promo-value" type="number" min="0" step="any" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promo-min">Minimum spend (R)</Label>
                <Input id="promo-min" type="number" min="0" step="any" placeholder="None" value={form.minOrderValue} onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-limit">Usage limit</Label>
                <Input id="promo-limit" type="number" min="1" step="1" placeholder="No limit" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promo-start">Starts</Label>
                <Input id="promo-start" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-end">Ends</Label>
                <Input id="promo-end" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              The code stops working for {deleting ? storeName.get(deleting.store_id) || "this store" : ""} straight away. Orders that already used it keep their discount. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPromotions;
