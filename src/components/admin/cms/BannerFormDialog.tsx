import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface BannerFormData {
  title: string;
  image_url: string;
  link_url: string;
  position: "hero" | "promo" | "sidebar";
  is_active: boolean;
  display_order: number;
}

interface BannerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner: BannerFormData | null;
  onBannerChange: (banner: BannerFormData) => void;
  onSave: () => void;
  isLoading: boolean;
  isEditing: boolean;
}

const BannerFormDialog: React.FC<BannerFormDialogProps> = ({
  open,
  onOpenChange,
  banner,
  onBannerChange,
  onSave,
  isLoading,
  isEditing,
}) => {
  if (!banner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Banner" : "Create New Banner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="banner-title">Banner Title</Label>
            <Input
              id="banner-title"
              value={banner.title}
              onChange={(e) => onBannerChange({ ...banner, title: e.target.value })}
              placeholder="Summer Sale Banner"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              value={banner.image_url}
              onChange={(e) => onBannerChange({ ...banner, image_url: e.target.value })}
              placeholder="https://example.com/banner.jpg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link_url">Link URL</Label>
            <Input
              id="link_url"
              value={banner.link_url}
              onChange={(e) => onBannerChange({ ...banner, link_url: e.target.value })}
              placeholder="/shop/sale"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={banner.position}
                onValueChange={(value: "hero" | "promo" | "sidebar") =>
                  onBannerChange({ ...banner, position: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Hero</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="sidebar">Sidebar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                min={0}
                value={banner.display_order}
                onChange={(e) =>
                  onBannerChange({ ...banner, display_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={banner.is_active}
              onCheckedChange={(checked) => onBannerChange({ ...banner, is_active: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isLoading || !banner.title}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BannerFormDialog;
