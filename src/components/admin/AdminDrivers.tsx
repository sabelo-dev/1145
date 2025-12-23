import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Eye, CheckCircle, XCircle, Truck, Star } from "lucide-react";
import { format } from "date-fns";

interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_registration: string | null;
  license_number: string | null;
  status: string;
  rating: number | null;
  total_deliveries: number | null;
  created_at: string;
  profile?: {
    email: string;
    name: string | null;
  };
}

const AdminDrivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data: driversData, error } = await supabase
        .from("drivers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for all drivers
      const userIds = driversData?.map(d => d.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", userIds);

      // Map profiles to drivers
      const driversWithProfiles = (driversData || []).map(driver => ({
        ...driver,
        profile: profilesData?.find(p => p.id === driver.user_id) || undefined
      }));

      setDrivers(driversWithProfiles);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast({
        title: "Error",
        description: "Failed to load drivers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (driverId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ status: newStatus })
        .eq("id", driverId);

      if (error) throw error;

      setDrivers(drivers.map(d => 
        d.id === driverId ? { ...d, status: newStatus } : d
      ));

      toast({
        title: "Status Updated",
        description: `Driver status changed to ${newStatus}`,
      });

      if (selectedDriver?.id === driverId) {
        setSelectedDriver({ ...selectedDriver, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast({
        title: "Error",
        description: "Failed to update driver status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.vehicle_registration?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === "active").length,
    inactive: drivers.filter(d => d.status === "inactive").length,
    pending: drivers.filter(d => d.status === "pending").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.active}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.inactive}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Drivers Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Deliveries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No drivers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{driver.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {driver.profile?.email || "No email"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{driver.phone || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{driver.vehicle_type || "-"}</p>
                          <p className="text-sm text-muted-foreground">
                            {driver.vehicle_registration || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span>{driver.rating?.toFixed(1) || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{driver.total_deliveries || 0}</TableCell>
                      <TableCell>{getStatusBadge(driver.status)}</TableCell>
                      <TableCell>
                        {format(new Date(driver.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDriver(driver);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {driver.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateStatus(driver.id, "active")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleUpdateStatus(driver.id, "suspended")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {driver.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(driver.id, "suspended")}
                            >
                              Suspend
                            </Button>
                          )}
                          {driver.status === "suspended" && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(driver.id, "active")}
                            >
                              Reactivate
                            </Button>
                          )}
                          {driver.status === "inactive" && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(driver.id, "active")}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Driver Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Driver Details</DialogTitle>
          </DialogHeader>
          {selectedDriver && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedDriver.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedDriver.profile?.email || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedDriver.phone || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedDriver.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle Type</Label>
                  <p className="font-medium">{selectedDriver.vehicle_type || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle Registration</Label>
                  <p className="font-medium">{selectedDriver.vehicle_registration || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Number</Label>
                  <p className="font-medium">{selectedDriver.license_number || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rating</Label>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{selectedDriver.rating?.toFixed(1) || "N/A"}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Deliveries</Label>
                  <p className="font-medium">{selectedDriver.total_deliveries || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Joined</Label>
                  <p className="font-medium">
                    {format(new Date(selectedDriver.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <div className="flex gap-2">
                  {selectedDriver.status === "pending" && (
                    <>
                      <Button onClick={() => {
                        handleUpdateStatus(selectedDriver.id, "active");
                        setViewDialogOpen(false);
                      }}>
                        Approve Driver
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          handleUpdateStatus(selectedDriver.id, "suspended");
                          setViewDialogOpen(false);
                        }}
                      >
                        Reject Driver
                      </Button>
                    </>
                  )}
                  {selectedDriver.status === "active" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleUpdateStatus(selectedDriver.id, "suspended");
                        setViewDialogOpen(false);
                      }}
                    >
                      Suspend Driver
                    </Button>
                  )}
                  {selectedDriver.status === "suspended" && (
                    <Button onClick={() => {
                      handleUpdateStatus(selectedDriver.id, "active");
                      setViewDialogOpen(false);
                    }}>
                      Reactivate Driver
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDrivers;
