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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Check, X, Eye, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
}

const AdminDrivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // New driver form state
  const [newDriverEmail, setNewDriverEmail] = useState("");
  const [newDriverPassword, setNewDriverPassword] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverVehicleType, setNewDriverVehicleType] = useState("");
  const [newDriverVehicleReg, setNewDriverVehicleReg] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch drivers",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDriver = async () => {
    if (!newDriverEmail || !newDriverPassword || !newDriverName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Sign up the new user with driver role
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newDriverEmail,
        password: newDriverPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/driver/login`,
          data: {
            name: newDriverName,
            role: 'driver',
          }
        }
      });

      if (signUpError) throw signUpError;
      
      if (!signUpData.user) {
        throw new Error("Failed to create user");
      }

      // Wait for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Insert driver role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: signUpData.user.id, role: 'driver' });

      if (roleError) throw roleError;

      // Create driver record
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: signUpData.user.id,
          name: newDriverName,
          phone: newDriverPhone || null,
          vehicle_type: newDriverVehicleType || null,
          vehicle_registration: newDriverVehicleReg || null,
          license_number: newDriverLicense || null,
          status: 'offline',
        });

      if (driverError) throw driverError;

      toast({
        title: "Driver created",
        description: "New driver account has been created. They will receive a verification email.",
      });

      // Reset form and close dialog
      resetForm();
      setIsCreateDialogOpen(false);
      fetchDrivers();
    } catch (error: any) {
      console.error('Error creating driver:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create driver",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setNewDriverEmail("");
    setNewDriverPassword("");
    setNewDriverName("");
    setNewDriverPhone("");
    setNewDriverVehicleType("");
    setNewDriverVehicleReg("");
    setNewDriverLicense("");
  };

  const handleUpdateStatus = async (driverId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driverId);

      if (error) throw error;

      setDrivers(drivers.map(d => 
        d.id === driverId ? { ...d, status: newStatus } : d
      ));

      toast({
        title: "Status updated",
        description: `Driver status has been updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update driver status",
      });
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!confirm("Are you sure you want to delete this driver?")) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (error) throw error;

      setDrivers(drivers.filter(d => d.id !== driverId));

      toast({
        title: "Driver deleted",
        description: "Driver has been removed from the system.",
      });
    } catch (error) {
      console.error('Error deleting driver:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete driver",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500">Available</Badge>;
      case 'busy':
        return <Badge className="bg-amber-500">Busy</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: drivers.length,
    available: drivers.filter(d => d.status === 'available').length,
    busy: drivers.filter(d => d.status === 'busy').length,
    offline: drivers.filter(d => d.status === 'offline').length,
  };

  if (loading) {
    return <div>Loading drivers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Busy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.busy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.offline}</div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Driver Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Driver</DialogTitle>
              <DialogDescription>
                Enter the details for the new driver. They will receive an email to verify their account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="driver-name">Full Name *</Label>
                <Input
                  id="driver-name"
                  placeholder="John Doe"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-email">Email *</Label>
                <Input
                  id="driver-email"
                  type="email"
                  placeholder="driver@example.com"
                  value={newDriverEmail}
                  onChange={(e) => setNewDriverEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-password">Password *</Label>
                <Input
                  id="driver-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newDriverPassword}
                  onChange={(e) => setNewDriverPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-phone">Phone Number</Label>
                <Input
                  id="driver-phone"
                  placeholder="+27 xxx xxx xxxx"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-vehicle-type">Vehicle Type</Label>
                <Select value={newDriverVehicleType} onValueChange={setNewDriverVehicleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-vehicle-reg">Vehicle Registration</Label>
                <Input
                  id="driver-vehicle-reg"
                  placeholder="ABC 123 GP"
                  value={newDriverVehicleReg}
                  onChange={(e) => setNewDriverVehicleReg(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="driver-license">License Number</Label>
                <Input
                  id="driver-license"
                  placeholder="License number"
                  value={newDriverLicense}
                  onChange={(e) => setNewDriverLicense(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDriver} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Driver"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Drivers Table */}
      <Table>
        <TableCaption>List of all registered drivers</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Deliveries</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No drivers registered yet
              </TableCell>
            </TableRow>
          ) : (
            drivers.map(driver => (
              <TableRow key={driver.id}>
                <TableCell className="font-medium">{driver.name}</TableCell>
                <TableCell>{driver.phone || 'N/A'}</TableCell>
                <TableCell>
                  {driver.vehicle_type ? (
                    <span className="capitalize">{driver.vehicle_type}</span>
                  ) : 'N/A'}
                </TableCell>
                <TableCell>{getStatusBadge(driver.status)}</TableCell>
                <TableCell>{driver.rating?.toFixed(1) || '5.0'} ⭐</TableCell>
                <TableCell>{driver.total_deliveries || 0}</TableCell>
                <TableCell>{new Date(driver.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDriver(driver);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Select
                      value={driver.status}
                      onValueChange={(value) => handleUpdateStatus(driver.id, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDriver(driver.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* View Driver Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Driver Details</DialogTitle>
          </DialogHeader>
          {selectedDriver && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedDriver.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedDriver.phone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle Type</Label>
                  <p className="font-medium capitalize">{selectedDriver.vehicle_type || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle Registration</Label>
                  <p className="font-medium">{selectedDriver.vehicle_registration || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">License Number</Label>
                  <p className="font-medium">{selectedDriver.license_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedDriver.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rating</Label>
                  <p className="font-medium">{selectedDriver.rating?.toFixed(1) || '5.0'} ⭐</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Deliveries</Label>
                  <p className="font-medium">{selectedDriver.total_deliveries || 0}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Joined</Label>
                  <p className="font-medium">{new Date(selectedDriver.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDrivers;
