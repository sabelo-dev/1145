
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
  DollarSign, 
  TrendingUp, 
  Download, 
  CreditCard,
  Percent,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Payout {
  id: string;
  vendorName: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  scheduledDate: string;
  processedDate?: string;
  method: string;
}

interface Commission {
  id: string;
  orderId: string;
  vendorName: string;
  orderValue: number;
  commissionRate: number;
  commissionAmount: number;
  date: string;
  status: "earned" | "paid";
}

const AdminFinancials: React.FC = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCommissions: 0,
    pendingPayouts: 0,
    monthlyGrowth: 0
  });

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      // Fetch orders for revenue calculation
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('status', 'completed');

      const totalRevenue = orders?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;
      const totalCommissions = totalRevenue * 0.1; // 10% commission

      setStats({
        totalRevenue,
        totalCommissions,
        pendingPayouts: 0,
        monthlyGrowth: 0
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPayoutStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "processing": return "outline";
      case "pending": return "outline";
      case "failed": return "destructive";
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Financial Management</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button className="w-full sm:w-auto">Process Payouts</Button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCommissions)}</div>
            <p className="text-xs text-muted-foreground">
              10% average rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts)}</div>
            <p className="text-xs text-muted-foreground">
              Due this week
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyGrowth > 0 ? '+' : ''}{stats.monthlyGrowth}%</div>
            <p className="text-xs text-muted-foreground">
              vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payouts" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="payouts" className="flex-1 min-w-[80px]">Payouts</TabsTrigger>
          <TabsTrigger value="commissions" className="flex-1 min-w-[80px]">Commissions</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 min-w-[80px]">Reports</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 min-w-[80px]">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Payouts</CardTitle>
              <CardDescription>Manage and process vendor payments</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <EmptyState 
                  icon={CreditCard} 
                  title="No payouts yet" 
                  description="Vendor payouts will appear here once there are completed orders."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Vendor payout schedule</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Scheduled Date</TableHead>
                        <TableHead className="hidden md:table-cell">Payment Method</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-medium">{payout.vendorName}</TableCell>
                          <TableCell>{formatCurrency(payout.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={getPayoutStatusColor(payout.status)}>
                              {payout.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{new Date(payout.scheduledDate).toLocaleDateString()}</TableCell>
                          <TableCell className="hidden md:table-cell">{payout.method}</TableCell>
                          <TableCell className="text-right">
                            {payout.status === "pending" && (
                              <Button variant="outline" size="sm">
                                Process
                              </Button>
                            )}
                            {payout.status === "completed" && (
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
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

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle>Commission Tracking</CardTitle>
              <CardDescription>Track platform commissions from vendor sales</CardDescription>
            </CardHeader>
            <CardContent>
              {commissions.length === 0 ? (
                <EmptyState 
                  icon={Percent} 
                  title="No commissions yet" 
                  description="Commissions will appear here once orders are completed."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Commission earnings from vendor sales</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead className="hidden sm:table-cell">Vendor</TableHead>
                        <TableHead>Order Value</TableHead>
                        <TableHead className="hidden md:table-cell">Rate</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead className="hidden lg:table-cell">Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell className="font-medium">{commission.orderId}</TableCell>
                          <TableCell className="hidden sm:table-cell">{commission.vendorName}</TableCell>
                          <TableCell>{formatCurrency(commission.orderValue)}</TableCell>
                          <TableCell className="hidden md:table-cell">{commission.commissionRate}%</TableCell>
                          <TableCell>{formatCurrency(commission.commissionAmount)}</TableCell>
                          <TableCell className="hidden lg:table-cell">{new Date(commission.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={commission.status === "paid" ? "default" : "outline"}>
                              {commission.status}
                            </Badge>
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

        <TabsContent value="reports">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Financial Reports</CardTitle>
                <CardDescription>Generate and download financial statements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded gap-2">
                  <div>
                    <h4 className="font-medium">Monthly Revenue Report</h4>
                    <p className="text-sm text-muted-foreground">Comprehensive revenue breakdown</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded gap-2">
                  <div>
                    <h4 className="font-medium">Commission Statement</h4>
                    <p className="text-sm text-muted-foreground">Platform commission details</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded gap-2">
                  <div>
                    <h4 className="font-medium">Vendor Payout Report</h4>
                    <p className="text-sm text-muted-foreground">All vendor payments</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax & Compliance</CardTitle>
                <CardDescription>VAT and tax reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded gap-2">
                  <div>
                    <h4 className="font-medium">VAT Report</h4>
                    <p className="text-sm text-muted-foreground">15% VAT collection details</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded gap-2">
                  <div>
                    <h4 className="font-medium">Tax Summary</h4>
                    <p className="text-sm text-muted-foreground">Annual tax summary</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Financial Settings</CardTitle>
              <CardDescription>Configure commission rates and payment settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">Commission Settings</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Commission Rate</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        defaultValue="10" 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Featured Vendor Rate</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        defaultValue="8" 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-4">Payout Settings</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payout Frequency</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>Weekly</option>
                      <option>Bi-weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Minimum Payout Amount</label>
                    <input 
                      type="number" 
                      defaultValue="100" 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              <Button className="w-full sm:w-auto">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFinancials;
