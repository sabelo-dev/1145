
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
import { formatCurrency } from "@/lib/utils";
import { 
  Percent, 
  Tag, 
  Mail, 
  TrendingUp, 
  Plus,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";

interface Discount {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  description: string;
  usageLimit?: number;
  usageCount: number;
  startDate: string;
  endDate: string;
  status: "active" | "inactive" | "expired";
  scope: "global" | "vendor_specific";
  vendorId?: string;
}

interface Campaign {
  id: string;
  name: string;
  type: "flash_sale" | "promotion" | "boost";
  status: "active" | "scheduled" | "ended";
  startDate: string;
  endDate: string;
  participants: number;
  views: number;
  conversions: number;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  status: "draft" | "sending" | "sent";
  scheduledDate?: string;
}

const AdminPromotions: React.FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from Supabase tables
    setLoading(false);
  }, []);

  const getDiscountStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "inactive": return "outline";
      case "expired": return "destructive";
      default: return "default";
    }
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "scheduled": return "outline";
      case "ended": return "destructive";
      default: return "default";
    }
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

  const activeDiscounts = discounts.filter(d => d.status === "active").length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const sentEmails = emailCampaigns.filter(e => e.status === "sent").length;
  const totalEmailsSent = emailCampaigns.reduce((sum, e) => sum + e.sent, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Promotions & Marketing</h2>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Marketing Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Discounts</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDiscounts}</div>
            <p className="text-xs text-muted-foreground">
              {discounts.reduce((sum, d) => sum + d.usageCount, 0)} total uses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {campaigns.reduce((sum, c) => sum + c.views, 0).toLocaleString()} total views
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentEmails}</div>
            <p className="text-xs text-muted-foreground">
              {totalEmailsSent.toLocaleString()} emails sent
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground">
              No data yet
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="discounts" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="discounts" className="flex-1 min-w-[80px]">Discounts</TabsTrigger>
          <TabsTrigger value="campaigns" className="flex-1 min-w-[80px]">Campaigns</TabsTrigger>
          <TabsTrigger value="emails" className="flex-1 min-w-[80px]">Email</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 min-w-[80px]">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="discounts">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Discount Codes</CardTitle>
                  <CardDescription>Create and manage discount codes</CardDescription>
                </div>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  New Discount
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {discounts.length === 0 ? (
                <EmptyState 
                  icon={Tag} 
                  title="No discount codes yet" 
                  description="Create your first discount code to offer promotions to customers."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Discount codes and promotional offers</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="hidden md:table-cell">Usage</TableHead>
                        <TableHead className="hidden lg:table-cell">Valid Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discounts.map((discount) => (
                        <TableRow key={discount.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{discount.code}</div>
                              <div className="text-sm text-muted-foreground line-clamp-1">{discount.description}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">
                              {discount.type === "percentage" ? "%" : "R"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {discount.type === "percentage" 
                              ? `${discount.value}%` 
                              : formatCurrency(discount.value)
                            }
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">
                              {discount.usageCount}
                              {discount.usageLimit && ` / ${discount.usageLimit}`}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">
                              <div>{new Date(discount.startDate).toLocaleDateString()}</div>
                              <div className="text-muted-foreground">
                                to {new Date(discount.endDate).toLocaleDateString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getDiscountStatusColor(discount.status)}>
                              {discount.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Marketing Campaigns</CardTitle>
                  <CardDescription>Manage flash sales and promotional campaigns</CardDescription>
                </div>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <EmptyState 
                  icon={TrendingUp} 
                  title="No campaigns yet" 
                  description="Create your first marketing campaign to boost sales."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Marketing campaigns and promotions</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Duration</TableHead>
                        <TableHead className="hidden lg:table-cell">Participants</TableHead>
                        <TableHead className="hidden lg:table-cell">Performance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">
                              {campaign.type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">
                              <div>{new Date(campaign.startDate).toLocaleDateString()}</div>
                              <div className="text-muted-foreground">
                                to {new Date(campaign.endDate).toLocaleDateString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{campaign.participants}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">
                              <div>{campaign.views.toLocaleString()} views</div>
                              <div className="text-muted-foreground">
                                {campaign.conversions} conversions
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getCampaignStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Email Campaigns</CardTitle>
                  <CardDescription>Send promotional emails to customer segments</CardDescription>
                </div>
                <Button className="w-full sm:w-auto">
                  <Mail className="h-4 w-4 mr-2" />
                  New Email Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailCampaigns.length === 0 ? (
                <EmptyState 
                  icon={Mail} 
                  title="No email campaigns yet" 
                  description="Create your first email campaign to reach your customers."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Email marketing campaigns</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="hidden sm:table-cell">Recipients</TableHead>
                        <TableHead className="hidden md:table-cell">Delivery</TableHead>
                        <TableHead className="hidden lg:table-cell">Open Rate</TableHead>
                        <TableHead className="hidden lg:table-cell">Click Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailCampaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-sm text-muted-foreground line-clamp-1">{campaign.subject}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{campaign.recipients.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {campaign.sent > 0 
                              ? `${campaign.sent.toLocaleString()} sent` 
                              : campaign.scheduledDate 
                              ? `Scheduled: ${new Date(campaign.scheduledDate).toLocaleDateString()}`
                              : "Not scheduled"
                            }
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {campaign.sent > 0 
                              ? `${((campaign.opened / campaign.sent) * 100).toFixed(1)}%`
                              : "-"
                            }
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {campaign.sent > 0 
                              ? `${((campaign.clicked / campaign.sent) * 100).toFixed(1)}%`
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "sent" ? "default" : "outline"}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              {campaign.status === "draft" && (
                                <Button size="sm" className="hidden sm:inline-flex">Send</Button>
                              )}
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
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Discount Performance</CardTitle>
                <CardDescription>Track discount code usage and effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState 
                  icon={Percent} 
                  title="No analytics data" 
                  description="Analytics will appear here once discounts are created and used."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Analytics</CardTitle>
                <CardDescription>View campaign performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState 
                  icon={TrendingUp} 
                  title="No analytics data" 
                  description="Analytics will appear here once campaigns are run."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPromotions;
