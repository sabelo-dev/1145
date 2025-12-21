
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Package, MapPin, Settings, Store, Loader2 } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddressFormDialog from "@/components/account/AddressFormDialog";
import DeleteAddressDialog from "@/components/account/DeleteAddressDialog";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  itemCount: number;
}

interface Address {
  id: string;
  user_id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const AccountPage: React.FC = () => {
  const { user, isVendor, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressFormLoading, setAddressFormLoading] = useState(false);
  
  // Profile state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Notification preferences
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      fetchOrders();
      fetchAddresses();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    setOrdersLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, status, total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { count } = await supabase
            .from("order_items")
            .select("*", { count: "exact", head: true })
            .eq("order_id", order.id);
          
          return {
            ...order,
            itemCount: count || 0,
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchAddresses = async () => {
    if (!user) return;
    
    setAddressesLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      console.error("Error fetching addresses:", error);
      toast({
        title: "Error",
        description: "Failed to load addresses",
        variant: "destructive",
      });
    } finally {
      setAddressesLoading(false);
    }
  };

  const handleAddAddress = () => {
    setSelectedAddress(null);
    setAddressDialogOpen(true);
  };

  const handleEditAddress = (address: Address) => {
    setSelectedAddress(address);
    setAddressDialogOpen(true);
  };

  const handleDeleteClick = (address: Address) => {
    setSelectedAddress(address);
    setDeleteDialogOpen(true);
  };

  const handleAddressSubmit = async (data: {
    label: string;
    name: string;
    street: string;
    city: string;
    province: string;
    postal_code: string;
    phone: string;
    is_default: boolean;
  }) => {
    if (!user) return;
    
    setAddressFormLoading(true);
    try {
      // If setting as default, first unset other defaults
      if (data.is_default) {
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      if (selectedAddress) {
        // Update existing address
        const { error } = await supabase
          .from("user_addresses")
          .update({
            label: data.label,
            name: data.name,
            street: data.street,
            city: data.city,
            province: data.province,
            postal_code: data.postal_code,
            phone: data.phone || null,
            is_default: data.is_default,
          })
          .eq("id", selectedAddress.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Address updated successfully",
        });
      } else {
        // Create new address
        const { error } = await supabase
          .from("user_addresses")
          .insert({
            user_id: user.id,
            label: data.label,
            name: data.name,
            street: data.street,
            city: data.city,
            province: data.province,
            postal_code: data.postal_code,
            phone: data.phone || null,
            is_default: data.is_default || addresses.length === 0, // First address is default
          });

        if (error) throw error;
        toast({
          title: "Success",
          description: "Address added successfully",
        });
      }

      setAddressDialogOpen(false);
      fetchAddresses();
    } catch (error: any) {
      console.error("Error saving address:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save address",
        variant: "destructive",
      });
    } finally {
      setAddressFormLoading(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!selectedAddress) return;
    
    setAddressFormLoading(true);
    try {
      const { error } = await supabase
        .from("user_addresses")
        .delete()
        .eq("id", selectedAddress.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Address deleted successfully",
      });
      
      setDeleteDialogOpen(false);
      fetchAddresses();
    } catch (error: any) {
      console.error("Error deleting address:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete address",
        variant: "destructive",
      });
    } finally {
      setAddressFormLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          phone: phone.trim(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshUserProfile();
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "default";
      case "shipped":
        return "secondary";
      case "processing":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="wwe-container py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-wwe-navy mb-2">My Account</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-wwe-navy rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-white" />
                </div>
                <CardTitle>{user.name || user.email}</CardTitle>
                <CardDescription>
                  <Badge variant={user.role === 'vendor' ? 'default' : 'secondary'}>
                    {user.role === 'vendor' ? 'Vendor' : 'Consumer'}
                  </Badge>
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Orders
                </TabsTrigger>
                <TabsTrigger value="addresses" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Addresses
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information and account details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input 
                          id="name" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          value={user.email} 
                          disabled 
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Enter your phone number"
                        />
                      </div>
                    </div>
                    
                    {user.role === 'consumer' && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <Store className="h-6 w-6 text-blue-600" />
                          <div>
                            <h3 className="font-semibold text-blue-900">Become a Vendor</h3>
                            <p className="text-blue-700 text-sm">Start selling your products on our platform</p>
                          </div>
                        </div>
                        <Link to="/vendor/register" className="mt-3 inline-block">
                          <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                            Apply Now
                          </Button>
                        </Link>
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="bg-wwe-navy hover:bg-wwe-navy/90"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Profile
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order History</CardTitle>
                    <CardDescription>
                      View and track your recent orders
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ordersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg mb-2">No orders yet</h3>
                        <p className="text-muted-foreground mb-4">
                          You haven't placed any orders yet. Start shopping to see your orders here.
                        </p>
                        <Link to="/shop">
                          <Button className="bg-wwe-navy hover:bg-wwe-navy/90">
                            Browse Products
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {orders.map((order) => (
                          <div key={order.id} className="border rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between">
                              <div>
                                <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                                <p className="text-sm text-gray-600">
                                  {new Date(order.created_at).toLocaleDateString()} • {order.itemCount} item(s)
                                </p>
                              </div>
                              <div className="mt-2 md:mt-0 flex items-center gap-4">
                                <Badge variant={getStatusVariant(order.status)}>
                                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </Badge>
                                <span className="font-semibold">R{order.total.toFixed(2)}</span>
                                <Button variant="outline" size="sm">
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Addresses Tab */}
              <TabsContent value="addresses" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Shipping Addresses</CardTitle>
                        <CardDescription>
                          Manage your shipping and billing addresses
                        </CardDescription>
                      </div>
                      <Button onClick={handleAddAddress} className="bg-wwe-navy hover:bg-wwe-navy/90">
                        Add Address
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {addressesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : addresses.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-lg mb-2">No addresses saved</h3>
                        <p className="text-muted-foreground mb-4">
                          Add a shipping address to make checkout faster.
                        </p>
                        <Button onClick={handleAddAddress} className="bg-wwe-navy hover:bg-wwe-navy/90">
                          Add Your First Address
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {addresses.map((address) => (
                          <div key={address.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{address.label}</h3>
                                  {address.is_default && (
                                    <Badge variant="outline">Default</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {address.name}<br/>
                                  {address.street}<br/>
                                  {address.city}, {address.province} {address.postal_code}
                                  {address.phone && <><br/>{address.phone}</>}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditAddress(address)}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeleteClick(address)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Password & Security</CardTitle>
                      <CardDescription>
                        Update your password and security settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input 
                          id="newPassword" 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input 
                          id="confirmPassword" 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                      <Button 
                        onClick={handleUpdatePassword}
                        disabled={loading || !newPassword || !confirmPassword}
                        className="bg-wwe-navy hover:bg-wwe-navy/90"
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>
                        Manage your email and notification preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <Label htmlFor="order-updates" className="font-medium cursor-pointer">
                            Order Updates
                          </Label>
                          <p className="text-sm text-muted-foreground">Get notified about order status changes</p>
                        </div>
                        <Switch 
                          id="order-updates"
                          checked={orderUpdates}
                          onCheckedChange={setOrderUpdates}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <Label htmlFor="promotions" className="font-medium cursor-pointer">
                            Promotions
                          </Label>
                          <p className="text-sm text-muted-foreground">Receive promotional emails and offers</p>
                        </div>
                        <Switch 
                          id="promotions"
                          checked={promotions}
                          onCheckedChange={setPromotions}
                        />
                      </div>
                      <Button 
                        onClick={() => {
                          toast({
                            title: "Success",
                            description: "Notification preferences saved",
                          });
                        }}
                        className="bg-wwe-navy hover:bg-wwe-navy/90"
                      >
                        Save Preferences
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Address Form Dialog */}
      <AddressFormDialog
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        onSubmit={handleAddressSubmit}
        address={selectedAddress}
        loading={addressFormLoading}
      />

      {/* Delete Address Confirmation Dialog */}
      <DeleteAddressDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteAddress}
        loading={addressFormLoading}
        addressLabel={selectedAddress?.label}
      />
    </div>
  );
};

export default AccountPage;
