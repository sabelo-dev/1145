
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  Calendar, 
  Download,
  Search,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VendorPayouts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutData, setPayoutData] = useState({
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    commissionRate: 10, // 10%
    minimumPayout: 100.00,
    nextPayoutDate: "2024-01-20"
  });

  useEffect(() => {
    fetchPayoutData();
  }, [user?.id]);

  const fetchPayoutData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get vendor data first
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;

      // Get payouts for this vendor
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;

      // Get vendor earnings from order items
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id);

      if (storesError) throw storesError;

      if (stores.length > 0) {
        const storeIds = stores.map(store => store.id);
        
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('order_items')
          .select('price, quantity, vendor_status')
          .in('store_id', storeIds);

        if (orderItemsError) throw orderItemsError;

        const totalRevenue = orderItems?.reduce((sum, item) => 
          sum + (parseFloat(item.price?.toString() || '0') * item.quantity), 0) || 0;
        
        const availableBalance = totalRevenue * 0.9; // After 10% commission
        const totalEarnings = totalRevenue;

        setPayoutData(prev => ({
          ...prev,
          availableBalance,
          totalEarnings,
          pendingBalance: totalRevenue * 0.1 // Simulated pending
        }));
      }

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch payout data",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async () => {
    if (!canRequestPayout) {
      toast({
        variant: "destructive",
        title: "Cannot request payout",
        description: "Your available balance is below the minimum payout threshold of R100."
      });
      return;
    }

    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('payouts')
        .insert([
          {
            vendor_id: vendor.id,
            amount: payoutData.availableBalance,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      toast({
        title: "Payout requested",
        description: "Your payout request has been submitted successfully."
      });

      fetchPayoutData();
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to request payout"
      });
    }
  };

  const canRequestPayout = payoutData.availableBalance >= 100;

  const payoutHistory = payouts.map(payout => ({
    id: `PAY-${payout.id.slice(-3)}`,
    amount: parseFloat(payout.amount?.toString() || '0'),
    commission: parseFloat(payout.amount?.toString() || '0') * 0.1,
    netAmount: parseFloat(payout.amount?.toString() || '0') * 0.9,
    status: payout.status,
    requestDate: new Date(payout.created_at).toLocaleDateString(),
    paidDate: payout.payout_date ? new Date(payout.payout_date).toLocaleDateString() : null,
    method: "Bank Transfer"
  }));

  const filteredPayouts = payoutHistory.filter(payout =>
    payout.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportPayoutHistory = () => {
    const csvData = [
      ['Payout ID', 'Gross Amount', 'Commission', 'Net Amount', 'Status', 'Request Date', 'Paid Date', 'Method'],
      ...filteredPayouts.map(payout => [
        payout.id,
        payout.amount.toFixed(2),
        payout.commission.toFixed(2),
        payout.netAmount.toFixed(2),
        payout.status,
        payout.requestDate,
        payout.paidDate || 'N/A',
        payout.method
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `payout-history-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Successful",
      description: "Payout history has been exported to CSV."
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case "pending":
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments & Payouts</h2>
          <p className="text-muted-foreground">
            Manage your earnings and payout requests.
          </p>
        </div>
        <Button 
          disabled={!canRequestPayout}
          className="bg-green-600 hover:bg-green-700"
          onClick={requestPayout}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Request Payout
        </Button>
      </div>

      {/* Balance Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R{payoutData.availableBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for payout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R{payoutData.pendingBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R{payoutData.totalEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payoutData.commissionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Platform fee
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payout Information</CardTitle>
            <CardDescription>
              Current payout settings and schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Minimum Payout Amount:</span>
              <span className="font-medium">R{payoutData.minimumPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Next Scheduled Payout:</span>
              <span className="font-medium">{payoutData.nextPayoutDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Payout Method:</span>
              <span className="font-medium flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                Bank Transfer
              </span>
            </div>
            <div className="pt-2">
              {!canRequestPayout && (
                <p className="text-sm text-orange-600">
                  Minimum payout amount not reached. Need R{(payoutData.minimumPayout - payoutData.availableBalance).toFixed(2)} more.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings Breakdown</CardTitle>
            <CardDescription>
              Commission and fee details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gross Sales</span>
                <span>R{(payoutData.availableBalance / (1 - payoutData.commissionRate / 100)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Platform Commission ({payoutData.commissionRate}%)</span>
                <span className="text-red-600">
                  -R{((payoutData.availableBalance / (1 - payoutData.commissionRate / 100)) * payoutData.commissionRate / 100).toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-medium">
                  <span>Net Earnings</span>
                  <span className="text-green-600">R{payoutData.availableBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payout history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={exportPayoutHistory}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            Track all your payout requests and payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payout history...</div>
          ) : filteredPayouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payout history found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout ID</TableHead>
                  <TableHead>Gross Amount</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">{payout.id}</TableCell>
                    <TableCell>${payout.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-red-600">-${payout.commission.toFixed(2)}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      ${payout.netAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell>{payout.requestDate}</TableCell>
                    <TableCell>{payout.paidDate || "-"}</TableCell>
                    <TableCell>{payout.method}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorPayouts;
