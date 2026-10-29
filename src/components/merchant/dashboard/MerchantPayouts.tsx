
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

interface MerchantPayoutsProps {
  /** Switches the dashboard tab (used to send the merchant to their bank details). */
  onNavigate?: (tab: string) => void;
}

const MerchantPayouts = ({ onNavigate }: MerchantPayoutsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  // Worked out by the database (merchant_payout_summary), never in the browser.
  const [payoutData, setPayoutData] = useState({
    availableBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    grossSales: 0,
    commission: 0,
    commissionRate: 10,
    minimumPayout: 100,
    payoutDays: 7,
    hasVerifiedBank: false,
    hasOpenRequest: false,
  });

  useEffect(() => {
    fetchPayoutData();
  }, [user?.id]);

  const fetchPayoutData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get merchant data first
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchantError) throw merchantError;

      // Get payouts for this merchant
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;

      const { data: summary, error: summaryError } = await (supabase.rpc as any)('merchant_payout_summary');

      if (summaryError) throw summaryError;

      setPayoutData({
        availableBalance: Number(summary.available_balance) || 0,
        pendingBalance: Number(summary.pending_balance) || 0,
        totalEarnings: Number(summary.total_earnings) || 0,
        grossSales: Number(summary.gross_sales) || 0,
        commission: Number(summary.commission) || 0,
        commissionRate: Number(summary.commission_rate) || 0,
        minimumPayout: Number(summary.minimum_payout) || 100,
        payoutDays: Number(summary.payout_days) || 7,
        hasVerifiedBank: Boolean(summary.has_verified_bank),
        hasOpenRequest: Boolean(summary.has_open_request),
      });

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

  // Why a payout cannot be requested right now, or null when it can.
  const payoutBlockedReason = !payoutData.hasVerifiedBank
    ? "Add a verified bank account before requesting a payout."
    : payoutData.hasOpenRequest
      ? "You already have a payout request in progress."
      : payoutData.availableBalance < payoutData.minimumPayout
        ? `Minimum payout amount not reached. Need R${(payoutData.minimumPayout - payoutData.availableBalance).toFixed(2)} more.`
        : null;
  const canRequestPayout = !loading && payoutBlockedReason === null;

  const requestPayout = async () => {
    if (!canRequestPayout || requesting) return;

    try {
      setRequesting(true);
      // The database works out the amount and checks every rule again.
      const { error } = await (supabase.rpc as any)('request_merchant_payout');

      if (error) throw error;

      toast({
        title: "Payout requested",
        description: `Your payout request for R${payoutData.availableBalance.toFixed(2)} has been submitted.`
      });
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast({
        variant: "destructive",
        title: "Payout not requested",
        description: (error as { message?: string })?.message || "Failed to request payout"
      });
    } finally {
      setRequesting(false);
      fetchPayoutData();
    }
  };

  const payoutHistory = payouts.map(payout => ({
    id: `PAY-${payout.id.slice(-3)}`,
    // A payout is requested for the balance after commission.
    amount: parseFloat(payout.amount?.toString() || '0'),
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
      ['Payout ID', 'Amount', 'Status', 'Request Date', 'Paid Date', 'Method'],
      ...filteredPayouts.map(payout => [
        payout.id,
        payout.amount.toFixed(2),
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
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments & Payouts</h2>
          <p className="text-muted-foreground">
            Manage your earnings and payout requests.
          </p>
        </div>
        <Button 
          disabled={!canRequestPayout || requesting}
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
              Delivered orders, after commission and payouts
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
              Paid orders not delivered yet
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
              Delivered orders, after commission
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
              <span className="text-sm">Processing Time:</span>
              <span className="font-medium">Up to {payoutData.payoutDays} days after a request</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Payout Method:</span>
              <span className="font-medium flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                {payoutData.hasVerifiedBank ? "Bank Transfer" : "No verified bank account"}
              </span>
            </div>
            <div className="pt-2 space-y-2">
              {!loading && payoutBlockedReason && (
                <p className="text-sm text-orange-600">{payoutBlockedReason}</p>
              )}
              {!loading && !payoutData.hasVerifiedBank && onNavigate && (
                <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
                  Add bank account
                </Button>
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
                <span>R{payoutData.grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Platform Commission ({payoutData.commissionRate}%)</span>
                <span className="text-red-600">
                  -R{payoutData.commission.toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-medium">
                  <span>Net Earnings</span>
                  <span className="text-green-600">R{payoutData.totalEarnings.toFixed(2)}</span>
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
                  <TableHead>Amount</TableHead>
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
                    <TableCell className="font-medium text-green-600">R{payout.amount.toFixed(2)}</TableCell>
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

export default MerchantPayouts;
