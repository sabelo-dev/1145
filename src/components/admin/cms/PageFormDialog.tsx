import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface PageFormData {
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  status: "published" | "draft";
}

interface PageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageFormData | null;
  onPageChange: (page: PageFormData) => void;
  onSave: () => void;
  isLoading: boolean;
  isEditing: boolean;
}

const PageFormDialog: React.FC<PageFormDialogProps> = ({
  open,
  onOpenChange,
  page,
  onPageChange,
  onSave,
  isLoading,
  isEditing,
}) => {
  if (!page) return null;

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Page" : "Create New Page"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={page.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  onPageChange({
                    ...page,
                    title: newTitle,
                    slug: isEditing ? page.slug : generateSlug(newTitle),
                  });
                }}
                placeholder="About Us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={page.slug}
                onChange={(e) => onPageChange({ ...page, slug: e.target.value })}
                placeholder="about-us"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description">Meta Description (SEO)</Label>
            <Input
              id="meta_description"
              value={page.meta_description}
              onChange={(e) => onPageChange({ ...page, meta_description: e.target.value })}
              placeholder="Brief description for search engines..."
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">{page.meta_description.length}/160 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              className="min-h-[200px]"
              value={page.content}
              onChange={(e) => onPageChange({ ...page, content: e.target.value })}
              placeholder="Enter page content..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={page.status}
              onValueChange={(value: "published" | "draft") =>
                onPageChange({ ...page, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isLoading || !page.title || !page.slug}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PageFormDialog;
