
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Image, 
  FileText, 
  Mail, 
  Upload, 
  Edit, 
  Trash2,
  Eye,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: "hero" | "sidebar" | "footer";
  status: "active" | "inactive";
  startDate: string;
  endDate?: string;
}

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  status: "published" | "draft" | "scheduled";
  publishDate: string;
  author: string;
  views: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  type: "welcome" | "order_confirmation" | "shipping" | "promo";
  status: "active" | "inactive";
  lastModified: string;
}

const AdminContent: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // In production, fetch from Supabase tables
    // For now, initialize with empty arrays
    setLoading(false);
  }, []);

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
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Content Management</h2>
      </div>

      <Tabs defaultValue="banners" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="banners" className="flex-1 min-w-[100px]">Banners</TabsTrigger>
          <TabsTrigger value="blog" className="flex-1 min-w-[100px]">Blog</TabsTrigger>
          <TabsTrigger value="emails" className="flex-1 min-w-[100px]">Email Templates</TabsTrigger>
          <TabsTrigger value="pages" className="flex-1 min-w-[100px]">Static Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="banners">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Website Banners</CardTitle>
                    <CardDescription>Manage homepage and promotional banners</CardDescription>
                  </div>
                  <Button className="w-full sm:w-auto">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Banner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {banners.length === 0 ? (
                  <EmptyState 
                    icon={Image} 
                    title="No banners yet" 
                    description="Upload your first banner to display promotional content on your site."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Website banners and promotional content</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden sm:table-cell">Position</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {banners.map((banner) => (
                          <TableRow key={banner.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                                  <Image className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="font-medium">{banner.title}</div>
                                  <div className="text-sm text-muted-foreground">{banner.linkUrl}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline">{banner.position}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={banner.status === "active" ? "default" : "outline"}>
                                {banner.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="text-sm">
                                <div>{new Date(banner.startDate).toLocaleDateString()}</div>
                                {banner.endDate && (
                                  <div className="text-muted-foreground">
                                    to {new Date(banner.endDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                                  <Trash2 className="h-4 w-4" />
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
          </div>
        </TabsContent>

        <TabsContent value="blog">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Blog Posts</CardTitle>
                    <CardDescription>Manage blog content and news updates</CardDescription>
                  </div>
                  <Button className="w-full sm:w-auto">
                    <FileText className="h-4 w-4 mr-2" />
                    New Post
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {blogPosts.length === 0 ? (
                  <EmptyState 
                    icon={FileText} 
                    title="No blog posts yet" 
                    description="Create your first blog post to engage with your audience."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Blog posts and articles</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Author</TableHead>
                          <TableHead className="hidden md:table-cell">Publish Date</TableHead>
                          <TableHead className="hidden lg:table-cell">Views</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blogPosts.map((post) => (
                          <TableRow key={post.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{post.title}</div>
                                <div className="text-sm text-muted-foreground line-clamp-1">{post.excerpt}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  post.status === "published" 
                                    ? "default" 
                                    : "outline"
                                }
                              >
                                {post.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{post.author}</TableCell>
                            <TableCell className="hidden md:table-cell">{new Date(post.publishDate).toLocaleDateString()}</TableCell>
                            <TableCell className="hidden lg:table-cell">{post.views.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
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
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>Manage automated email templates</CardDescription>
                  </div>
                  <Button className="w-full sm:w-auto">
                    <Mail className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {emailTemplates.length === 0 ? (
                  <EmptyState 
                    icon={Mail} 
                    title="No email templates yet" 
                    description="Create email templates for automated customer communications."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Email templates for automated communications</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Last Modified</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailTemplates.map((template) => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline">
                                {template.type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={template.status === "active" ? "default" : "outline"}>
                                {template.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{new Date(template.lastModified).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
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
          </div>
        </TabsContent>

        <TabsContent value="pages">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Static Pages</CardTitle>
                <CardDescription>Manage terms, FAQ, about us, and other static content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">Terms of Service</h4>
                        <p className="text-sm text-muted-foreground">Legal terms and conditions</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">Privacy Policy</h4>
                        <p className="text-sm text-muted-foreground">Data protection and privacy</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">FAQ</h4>
                        <p className="text-sm text-muted-foreground">Frequently asked questions</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">About Us</h4>
                        <p className="text-sm text-muted-foreground">Company information</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">Contact Information</h4>
                        <p className="text-sm text-muted-foreground">Support and contact details</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">Shipping Policy</h4>
                        <p className="text-sm text-muted-foreground">Delivery terms and conditions</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminContent;
