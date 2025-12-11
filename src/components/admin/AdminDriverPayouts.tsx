import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Plus,
  Eye,
  CreditCard,
  Truck,
  RefreshCw,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  total_deliveries: number | null;
}

interface DriverEarnings {
  driver_id: string;
  driver_name: string;
  total_earnings: number;
  total_deliveries: number;
  total_distance: number;
  pending_payout: number;
}

interface Payout {
  id: string;
  driver_id: string;
  amount: number;
  status: string;
  period_start: string;
  period_end: string;
  deliveries_count: number;
  total_distance_km: number;
  payment_method: string | null;
  payment_reference: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
  driver?: Driver;
}

const AdminDriverPayouts: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [earnings, setEarnings] = useState<DriverEarnings[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("earnings");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Create payout form state
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [payoutNotes, setPayoutNotes] = useState("");

  // Process payout form state
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchDrivers(), fetchEarnings(), fetchPayouts()]);
    setLoading(false);
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, phone, total_deliveries")
        .order("name");

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const fetchEarnings = async () => {
    try {
      // Get all delivery jobs grouped by driver
      const { data: jobs, error: jobsError } = await supabase
        .from("delivery_jobs")
        .select("driver_id, earnings, distance_km, status")
        .eq("status", "delivered");

      if (jobsError) throw jobsError;

      // Get all processed payouts
      const { data: processedPayouts, error: payoutsError } = await supabase
        .from("driver_payouts")
        .select("driver_id, amount")
        .eq("status", "completed");

      if (payoutsError) throw payoutsError;

      // Get drivers
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("id, name");

      if (driversError) throw driversError;

      // Calculate earnings per driver
      const earningsMap = new Map<string, DriverEarnings>();

      driversData?.forEach((driver) => {
        earningsMap.set(driver.id, {
          driver_id: driver.id,
          driver_name: driver.name,
          total_earnings: 0,
          total_deliveries: 0,
          total_distance: 0,
          pending_payout: 0,
        });
      });

      jobs?.forEach((job) => {
        if (job.driver_id && earningsMap.has(job.driver_id)) {
          const current = earningsMap.get(job.driver_id)!;
          current.total_earnings += Number(job.earnings) || 0;
          current.total_deliveries += 1;
          current.total_distance += Number(job.distance_km) || 0;
        }
      });

      // Subtract completed payouts
      const paidMap = new Map<string, number>();
      processedPayouts?.forEach((payout) => {
        const current = paidMap.get(payout.driver_id) || 0;
        paidMap.set(payout.driver_id, current + Number(payout.amount));
      });

      earningsMap.forEach((earning, driverId) => {
        const paid = paidMap.get(driverId) || 0;
        earning.pending_payout = earning.total_earnings - paid;
      });

      setEarnings(Array.from(earningsMap.values()).filter((e) => e.total_deliveries > 0 || e.pending_payout !== 0));
    } catch (error) {
      console.error("Error fetching earnings:", error);
    }
  };

  const fetchPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_payouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Attach driver names
      const driverIds = [...new Set(data?.map((p) => p.driver_id))];
      const { data: driversData } = await supabase
        .from("drivers")
        .select("id, name, phone, total_deliveries")
        .in("id", driverIds);

      const driverMap = new Map(driversData?.map((d) => [d.id, d]));

      const payoutsWithDrivers = data?.map((payout) => ({
        ...payout,
        driver: driverMap.get(payout.driver_id),
      }));

      setPayouts(payoutsWithDrivers || []);
    } catch (error) {
      console.error("Error fetching payouts:", error);
    }
  };

  const handleCreatePayout = async () => {
    if (!selectedDriverId || !payoutAmount || !periodStart || !periodEnd) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    setIsCreating(true);
    try {
      const driverEarning = earnings.find((e) => e.driver_id === selectedDriverId);

      const { error } = await supabase.from("driver_payouts").insert({
        driver_id: selectedDriverId,
        amount: parseFloat(payoutAmount),
        period_start: periodStart,
        period_end: periodEnd,
        deliveries_count: driverEarning?.total_deliveries || 0,
        total_distance_km: driverEarning?.total_distance || 0,
        notes: payoutNotes || null,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Payout Created",
        description: "Payout request has been created successfully",
      });

      resetCreateForm();
      setIsCreateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error creating payout:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create payout",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleProcessPayout = async () => {
    if (!selectedPayout || !paymentMethod) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a payment method",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("driver_payouts")
        .update({
          status: "completed",
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedPayout.id);

      if (error) throw error;

      toast({
        title: "Payout Processed",
        description: "Payout has been marked as completed",
      });

      setIsProcessDialogOpen(false);
      setSelectedPayout(null);
      resetProcessForm();
      fetchData();
    } catch (error: any) {
      console.error("Error processing payout:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process payout",
      });
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!confirm("Are you sure you want to cancel this payout?")) return;

    try {
      const { error } = await supabase
        .from("driver_payouts")
        .update({ status: "cancelled" })
        .eq("id", payoutId);

      if (error) throw error;

      toast({
        title: "Payout Cancelled",
        description: "Payout has been cancelled",
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel payout",
      });
    }
  };

  const resetCreateForm = () => {
    setSelectedDriverId("");
    setPayoutAmount("");
    setPeriodStart(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setPeriodEnd(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setPayoutNotes("");
  };

  const resetProcessForm = () => {
    setPaymentMethod("");
    setPaymentReference("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">Pending</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Stats
  const stats = {
    totalPending: payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0),
    totalPaid: payouts.filter((p) => p.status === "completed").reduce((sum, p) => sum + Number(p.amount), 0),
    pendingCount: payouts.filter((p) => p.status === "pending").length,
    thisMonth: payouts
      .filter((p) => p.status === "completed" && new Date(p.processed_at || p.created_at) >= startOfMonth(new Date()))
      .reduce((sum, p) => sum + Number(p.amount), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalPending)}</div>
            <p className="text-xs text-muted-foreground">{stats.pendingCount} pending requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.thisMonth)}</div>
            <p className="text-xs text-muted-foreground">Paid out</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{earnings.length}</div>
            <p className="text-xs text-muted-foreground">With earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="earnings">Driver Earnings</TabsTrigger>
            <TabsTrigger value="payouts">Payout History</TabsTrigger>
          </TabsList>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Payout
          </Button>
        </div>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="mt-4">
          <Table>
            <TableCaption>Driver earnings summary</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Total Earnings</TableHead>
                <TableHead className="text-right">Deliveries</TableHead>
                <TableHead className="text-right">Distance (km)</TableHead>
                <TableHead className="text-right">Pending Payout</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No driver earnings yet
                  </TableCell>
                </TableRow>
              ) : (
                earnings.map((earning) => (
                  <TableRow key={earning.driver_id}>
                    <TableCell className="font-medium">{earning.driver_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(earning.total_earnings)}</TableCell>
                    <TableCell className="text-right">{earning.total_deliveries}</TableCell>
                    <TableCell className="text-right">{earning.total_distance.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <span className={earning.pending_payout > 0 ? "text-yellow-600 font-semibold" : ""}>
                        {formatCurrency(earning.pending_payout)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {earning.pending_payout > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedDriverId(earning.driver_id);
                            setPayoutAmount(earning.pending_payout.toString());
                            setIsCreateDialogOpen(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="mt-4">
          <Table>
            <TableCaption>Payout history</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Deliveries</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No payouts yet
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">{payout.driver?.name || "Unknown"}</TableCell>
                    <TableCell>
                      {format(new Date(payout.period_start), "dd MMM")} - {format(new Date(payout.period_end), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(payout.amount))}</TableCell>
                    <TableCell className="text-right">{payout.deliveries_count}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell>{payout.payment_method || "-"}</TableCell>
                    <TableCell>
                      {payout.processed_at
                        ? format(new Date(payout.processed_at), "dd MMM yyyy")
                        : format(new Date(payout.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {payout.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setIsProcessDialogOpen(true);
                              }}
                            >
                              Process
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelPayout(payout.id)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create Payout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout</DialogTitle>
            <DialogDescription>Create a new payout request for a driver</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Driver *</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount (ZAR) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Period Start *</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Period End *</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePayout} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payout Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription>
              Mark this payout of {selectedPayout && formatCurrency(Number(selectedPayout.amount))} as completed
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="eft">EFT</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment Reference</Label>
              <Input
                placeholder="Transaction ID or reference number"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcessPayout}>Mark as Completed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDriverPayouts;
