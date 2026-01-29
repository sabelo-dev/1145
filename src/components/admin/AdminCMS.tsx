import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Eye, Plus, Image, FileText, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageFormDialog from "./cms/PageFormDialog";
import BannerFormDialog from "./cms/BannerFormDialog";
import DeleteConfirmDialog from "./cms/DeleteConfirmDialog";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  status: "published" | "draft";
  created_at: string;
  updated_at: string;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: "hero" | "promo" | "sidebar";
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface PageFormData {
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  status: "published" | "draft";
}

interface BannerFormData {
  title: string;
  image_url: string;
  link_url: string;
  position: "hero" | "promo" | "sidebar";
  is_active: boolean;
  display_order: number;
}

const emptyPage: PageFormData = {
  title: "",
  slug: "",
  content: "",
  meta_description: "",
  status: "draft",
};

const emptyBanner: BannerFormData = {
  title: "",
  image_url: "",
  link_url: "",
  position: "hero",
  is_active: true,
  display_order: 0,
};

const AdminCMS: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Page form state
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageFormData | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  // Banner form state
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerFormData | null>(null);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "page" | "banner"; id: string; title: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pagesResult, bannersResult] = await Promise.all([
        supabase.from("cms_pages").select("*").order("updated_at", { ascending: false }),
        supabase.from("cms_banners").select("*").order("display_order", { ascending: true }),
      ]);

      if (pagesResult.error) throw pagesResult.error;
      if (bannersResult.error) throw bannersResult.error;

      setPages(pagesResult.data as Page[]);
      setBanners(bannersResult.data as Banner[]);
    } catch (error: any) {
      console.error("Error fetching CMS data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Page operations
  const handleCreatePage = () => {
    setEditingPage({ ...emptyPage });
    setEditingPageId(null);
    setPageDialogOpen(true);
  };

  const handleEditPage = (page: Page) => {
    setEditingPage({
      title: page.title,
      slug: page.slug,
      content: page.content || "",
      meta_description: page.meta_description || "",
      status: page.status,
    });
    setEditingPageId(page.id);
    setPageDialogOpen(true);
  };

  const handleSavePage = async () => {
    if (!editingPage) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingPageId) {
        const { error } = await supabase
          .from("cms_pages")
          .update({
            title: editingPage.title,
            slug: editingPage.slug,
            content: editingPage.content,
            meta_description: editingPage.meta_description,
            status: editingPage.status,
            updated_by: user?.id,
          })
          .eq("id", editingPageId);
        if (error) throw error;
        toast({ title: "Page updated successfully" });
      } else {
        const { error } = await supabase.from("cms_pages").insert({
          title: editingPage.title,
          slug: editingPage.slug,
          content: editingPage.content,
          meta_description: editingPage.meta_description,
          status: editingPage.status,
          created_by: user?.id,
          updated_by: user?.id,
        });
        if (error) throw error;
        toast({ title: "Page created successfully" });
      }
      setPageDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving page:", error);
      toast({
        title: "Error saving page",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Banner operations
  const handleCreateBanner = () => {
    setEditingBanner({ ...emptyBanner });
    setEditingBannerId(null);
    setBannerDialogOpen(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner({
      title: banner.title,
      image_url: banner.image_url || "",
      link_url: banner.link_url || "",
      position: banner.position,
      is_active: banner.is_active,
      display_order: banner.display_order,
    });
    setEditingBannerId(banner.id);
    setBannerDialogOpen(true);
  };

  const handleSaveBanner = async () => {
    if (!editingBanner) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingBannerId) {
        const { error } = await supabase
          .from("cms_banners")
          .update({
            title: editingBanner.title,
            image_url: editingBanner.image_url,
            link_url: editingBanner.link_url,
            position: editingBanner.position,
            is_active: editingBanner.is_active,
            display_order: editingBanner.display_order,
          })
          .eq("id", editingBannerId);
        if (error) throw error;
        toast({ title: "Banner updated successfully" });
      } else {
        const { error } = await supabase.from("cms_banners").insert({
          title: editingBanner.title,
          image_url: editingBanner.image_url,
          link_url: editingBanner.link_url,
          position: editingBanner.position,
          is_active: editingBanner.is_active,
          display_order: editingBanner.display_order,
          created_by: user?.id,
        });
        if (error) throw error;
        toast({ title: "Banner created successfully" });
      }
      setBannerDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving banner:", error);
      toast({
        title: "Error saving banner",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete operations
  const handleDeleteClick = (type: "page" | "banner", id: string, title: string) => {
    setDeleteTarget({ type, id, title });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const table = deleteTarget.type === "page" ? "cms_pages" : "cms_banners";
      const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: `${deleteTarget.type === "page" ? "Page" : "Banner"} deleted successfully` });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast({
        title: "Error deleting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleBannerStatus = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from("cms_banners")
        .update({ is_active: !banner.is_active })
        .eq("id", banner.id);
      if (error) throw error;
      toast({ title: `Banner ${banner.is_active ? "deactivated" : "activated"}` });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error updating banner",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground text-center max-w-sm">{description}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">CMS / Pages Management</h2>
      </div>

      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="w-full flex h-auto">
          <TabsTrigger value="pages" className="flex-1">Static Pages</TabsTrigger>
          <TabsTrigger value="banners" className="flex-1">Banners & Promotions</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreatePage}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Page
            </Button>
          </div>

          <div className="grid gap-4">
            {pages.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={FileText}
                    title="No pages created yet"
                    description="Create static pages like About Us, FAQ, Privacy Policy, etc."
                  />
                </CardContent>
              </Card>
            ) : (
              pages.map((page) => (
                <Card key={page.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{page.title}</h3>
                          <Badge variant={page.status === "published" ? "default" : "secondary"}>
                            {page.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">/{page.slug}</p>
                        <p className="text-xs text-muted-foreground">
                          Last modified: {new Date(page.updated_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPage(page)}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="flex-1 sm:flex-none"
                        >
                          <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick("page", page.id, page.title)}
                          className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateBanner}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Banner
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Homepage Banners</CardTitle>
              <CardDescription>Manage promotional banners and hero images</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {banners.length === 0 ? (
                <EmptyState
                  icon={Image}
                  title="No banners yet"
                  description="Add promotional banners to display on your homepage."
                />
              ) : (
                banners.map((banner) => (
                  <div key={banner.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{banner.title}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {banner.position}
                          </Badge>
                          <Badge variant={banner.is_active ? "default" : "secondary"} className="text-xs">
                            {banner.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {banner.link_url && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Links to: {banner.link_url}
                          </p>
                        )}
                        {banner.image_url && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Image className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{banner.image_url}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBanner(banner)}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleBannerStatus(banner)}
                          className="flex-1 sm:flex-none"
                        >
                          {banner.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick("banner", banner.id, banner.title)}
                          className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PageFormDialog
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
        page={editingPage}
        onPageChange={setEditingPage}
        onSave={handleSavePage}
        isLoading={saving}
        isEditing={!!editingPageId}
      />

      <BannerFormDialog
        open={bannerDialogOpen}
        onOpenChange={setBannerDialogOpen}
        banner={editingBanner}
        onBannerChange={setEditingBanner}
        onSave={handleSaveBanner}
        isLoading={saving}
        isEditing={!!editingBannerId}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${deleteTarget?.type === "page" ? "Page" : "Banner"}`}
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
      />
    </div>
  );
};

export default AdminCMS;
