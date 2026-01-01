import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Save, Eye, Upload, Image, FileText, Loader2 } from "lucide-react";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: "published" | "draft";
  lastModified: string;
}

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  position: "hero" | "promo" | "sidebar";
}

const AdminCMS: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // In production, fetch from Supabase tables
    setLoading(false);
  }, []);

  const handleSavePage = () => {
    if (!editingPage) return;

    setPages(pages.map(page => 
      page.id === editingPage.id 
        ? { ...editingPage, lastModified: new Date().toISOString().split('T')[0] }
        : page
    ));
    
    setEditingPage(null);
    toast({
      title: "Page saved",
      description: "Page content has been updated successfully."
    });
  };

  const handleTogglePageStatus = (pageId: string) => {
    setPages(pages.map(page =>
      page.id === pageId
        ? { ...page, status: page.status === "published" ? "draft" : "published" }
        : page
    ));

    toast({
      title: "Page status updated",
      description: "Page status has been changed."
    });
  };

  const handleToggleBanner = (bannerId: string) => {
    setBanners(banners.map(banner =>
      banner.id === bannerId
        ? { ...banner, active: !banner.active }
        : banner
    ));

    toast({
      title: "Banner updated",
      description: "Banner status has been changed."
    });
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
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
          {editingPage ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit Page: {editingPage.title}</CardTitle>
                <CardDescription>Update page content and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Page Title</label>
                    <Input
                      value={editingPage.title}
                      onChange={(e) => setEditingPage({...editingPage, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">URL Slug</label>
                    <Input
                      value={editingPage.slug}
                      onChange={(e) => setEditingPage({...editingPage, slug: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    className="min-h-[200px]"
                    value={editingPage.content}
                    onChange={(e) => setEditingPage({...editingPage, content: e.target.value})}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleSavePage} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingPage(null)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
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
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{page.title}</h3>
                            <Badge 
                              variant={page.status === "published" ? "default" : "secondary"}
                            >
                              {page.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">/{page.slug}</p>
                          <p className="text-xs text-muted-foreground">
                            Last modified: {page.lastModified}
                          </p>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingPage(page)}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTogglePageStatus(page.id)}
                            className="flex-1 sm:flex-none"
                          >
                            {page.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
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
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{banner.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {banner.position}
                          </Badge>
                          <Badge 
                            variant={banner.active ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {banner.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Links to: {banner.linkUrl}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Image className="h-4 w-4" />
                          <span className="truncate max-w-[200px]">{banner.imageUrl}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleToggleBanner(banner.id)}
                          className="flex-1 sm:flex-none"
                        >
                          {banner.active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              <Button className="w-full" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Add New Banner
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCMS;
