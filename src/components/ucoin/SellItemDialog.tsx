import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { NewListingInput } from "@/hooks/useUCoinListings";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

interface SellItemDialogProps {
  busy: boolean;
  onUpload: (files: File[]) => Promise<string[]>;
  onCreate: (input: NewListingInput) => Promise<boolean>;
}

const CATEGORIES = ["Electronics", "Fashion", "Home", "Beauty", "Sport", "Kids", "Vehicles", "Other"];
const CONDITIONS = [
  { value: "new", label: "Brand new" },
  { value: "like_new", label: "Like new" },
  { value: "used", label: "Used" },
];

const SellItemDialog: React.FC<SellItemDialogProps> = ({ busy, onUpload, onCreate }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [condition, setCondition] = useState("used");
  const [price, setPrice] = useState("");
  const [allowBids, setAllowBids] = useState(false);
  const [startingBid, setStartingBid] = useState("");
  const [location, setLocation] = useState("");

  const reset = () => {
    setImages([]);
    setTitle("");
    setDescription("");
    setCategory("Other");
    setCondition("used");
    setPrice("");
    setAllowBids(false);
    setStartingBid("");
    setLocation("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const urls = await onUpload(Array.from(files).slice(0, 5));
    setUploading(false);
    if (!urls.length) {
      toast({ variant: "destructive", title: "Photos did not upload", description: "Try smaller photos and again." });
      return;
    }
    setImages((prev) => [...prev, ...urls].slice(0, 5));
  };

  const submit = async () => {
    const priceCoins = Math.floor(Number(price) || 0);
    if (!title.trim() || priceCoins <= 0) {
      toast({ variant: "destructive", title: "Missing details", description: "Add a title and a UCoin price." });
      return;
    }
    const ok = await onCreate({
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      price_ucoin: priceCoins,
      allow_bids: allowBids,
      starting_bid_ucoin: allowBids ? Math.floor(Number(startingBid) || 0) || null : null,
      location: location.trim(),
      images,
    });
    if (ok) {
      reset();
      setOpen(false);
    }
  };

  const priceCoins = Math.floor(Number(price) || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sell an item</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List an item for UCoin</DialogTitle>
          <DialogDescription>
            Buyers pay you in UCoin. 1 UCoin is worth R{UCOIN_RAND_VALUE.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="Item photo" className="h-16 w-16 rounded object-cover" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1"
                    onClick={() => setImages((prev) => prev.filter((i) => i !== url))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => handleFiles(e.target.files)} />
            {uploading && <p className="text-xs text-muted-foreground">Uploading photos…</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-title">What are you selling?</Label>
            <Input id="listing-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bluetooth speaker" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-desc">Description</Label>
            <Textarea
              id="listing-desc"
              value={description}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condition, age, what's included"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-price">Price in UCoin</Label>
            <Input
              id="listing-price"
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1500"
            />
            {priceCoins > 0 && (
              <p className="text-xs text-muted-foreground">
                That's about R{(priceCoins * UCOIN_RAND_VALUE).toFixed(2)}.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-medium">Accept offers</p>
              <p className="text-xs text-muted-foreground">Let buyers offer their own UCoin amount</p>
            </div>
            <Switch checked={allowBids} onCheckedChange={setAllowBids} />
          </div>

          {allowBids && (
            <div className="space-y-2">
              <Label htmlFor="listing-start">Lowest offer you'll consider</Label>
              <Input
                id="listing-start"
                type="number"
                inputMode="numeric"
                min={1}
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                placeholder="e.g. 900"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="listing-location">Where is it? (optional)</Label>
            <Input id="listing-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Sandton, Johannesburg" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || uploading}>
            {(busy || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            List item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SellItemDialog;
