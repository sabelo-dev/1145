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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types";
import { Plus, Search, Loader2, MoreHorizontal, Ban, Trash2, UserCheck, Eye } from "lucide-react";
import { BanUserDialog, UnbanUserDialog, DeleteUserDialog } from "./users/UserActionDialogs";
import UserDetailsDialog, { UserDetails } from "./users/UserDetailsDialog";

interface ExtendedProfile extends Profile {
  is_banned?: boolean;
  influencer_username?: string | null;
  phone?: string | null;
  totalOrders?: number;
  totalSpent?: number;
  totalReviews?: number;
  averageRating?: number;
  lastOrderDate?: string | null;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<ExtendedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // User action states
  const [selectedUser, setSelectedUser] = useState<ExtendedProfile | null>(null);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isUnbanDialogOpen, setIsUnbanDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // User details dialog states
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<UserDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (emailFilter?: string) => {
    try {
      setIsSearching(!!emailFilter);
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (emailFilter && emailFilter.trim()) {
        query = query.ilike('email', `%${emailFilter.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const userIds = (data || []).map(u => u.id);
      
      // Fetch all extended data in parallel
      const [influencerResult, ordersResult, reviewsResult] = await Promise.all([
        supabase
          .from('influencer_profiles')
          .select('user_id, username')
          .in('user_id', userIds),
        supabase
          .from('orders')
          .select('user_id, total, created_at')
          .in('user_id', userIds),
        supabase
          .from('reviews')
          .select('user_id, rating')
          .in('user_id', userIds),
      ]);

      const influencerMap = new Map(
        (influencerResult.data || []).map(i => [i.user_id, i.username])
      );

      // Calculate order stats per user
      const orderStatsMap = new Map<string, { totalOrders: number; totalSpent: number; lastOrderDate: string | null }>();
      (ordersResult.data || []).forEach(order => {
        const existing = orderStatsMap.get(order.user_id) || { totalOrders: 0, totalSpent: 0, lastOrderDate: null };
        existing.totalOrders += 1;
        existing.totalSpent += order.total || 0;
        if (!existing.lastOrderDate || new Date(order.created_at) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.created_at;
        }
        orderStatsMap.set(order.user_id, existing);
      });

      // Calculate review stats per user
      const reviewStatsMap = new Map<string, { totalReviews: number; averageRating: number }>();
      const reviewsByUser: Record<string, number[]> = {};
      (reviewsResult.data || []).forEach(review => {
        if (!reviewsByUser[review.user_id]) {
          reviewsByUser[review.user_id] = [];
        }
        reviewsByUser[review.user_id].push(review.rating);
      });
      Object.entries(reviewsByUser).forEach(([userId, ratings]) => {
        reviewStatsMap.set(userId, {
          totalReviews: ratings.length,
          averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        });
      });

      const usersWithData = (data || []).map(user => {
        const orderStats = orderStatsMap.get(user.id);
        const reviewStats = reviewStatsMap.get(user.id);
        return {
          ...user,
          influencer_username: influencerMap.get(user.id) || null,
          totalOrders: orderStats?.totalOrders ?? 0,
          totalSpent: orderStats?.totalSpent ?? 0,
          lastOrderDate: orderStats?.lastOrderDate ?? null,
          totalReviews: reviewStats?.totalReviews ?? 0,
          averageRating: reviewStats?.averageRating ?? 0,
        };
      });

      setUsers(usersWithData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleViewDetails = async (user: ExtendedProfile) => {
    setIsLoadingDetails(true);
    setIsDetailsDialogOpen(true);
    
    try {
      // Fetch additional user details including addresses from influencer profile
      const { data: influencerProfile } = await supabase
        .from('influencer_profiles')
        .select('street_address, city, province, postal_code, country, first_name, last_name, phone, date_of_birth, id_number')
        .eq('user_id', user.id)
        .maybeSingle();

      const addresses = influencerProfile && (influencerProfile.street_address || influencerProfile.city) 
        ? [{
            street_address: influencerProfile.street_address,
            city: influencerProfile.city,
            province: influencerProfile.province,
            postal_code: influencerProfile.postal_code,
            country: influencerProfile.country,
          }]
        : [];

      setDetailsUser({
        ...user,
        addresses,
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      setDetailsUser(user as UserDetails);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSearch = () => {
    fetchUsers(searchEmail);
  };

  const handleClearSearch = () => {
    setSearchEmail("");
    fetchUsers();
  };

  const handleBanUser = async () => {
    if (!selectedUser) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === selectedUser.id ? { ...u, is_banned: true } : u
      ));

      toast({
        title: "User banned",
        description: `${selectedUser.name || selectedUser.email} has been banned.`,
      });
    } catch (error) {
      console.error('Error banning user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to ban user",
      });
    } finally {
      setIsProcessing(false);
      setIsBanDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleUnbanUser = async () => {
    if (!selectedUser) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: false })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === selectedUser.id ? { ...u, is_banned: false } : u
      ));

      toast({
        title: "User unbanned",
        description: `${selectedUser.name || selectedUser.email} has been unbanned.`,
      });
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unban user",
      });
    } finally {
      setIsProcessing(false);
      setIsUnbanDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setIsProcessing(true);
    try {
      // Call the edge function to properly delete the user from auth and all related data
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to delete users");
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedUser.id },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setUsers(users.filter(u => u.id !== selectedUser.id));

      toast({
        title: "User deleted",
        description: `${selectedUser.name || selectedUser.email} has been permanently deleted.`,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user. They may have associated data that needs to be removed first.",
      });
    } finally {
      setIsProcessing(false);
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'consumer' | 'vendor' | 'admin' | 'driver' | 'influencer') => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (newRole === 'driver' || newRole === 'vendor' || newRole === 'influencer') {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'consumer');
        
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', newRole)
          .maybeSingle();
        
        if (!existingRole) {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: newRole });
          if (error) throw error;
        }

        if (newRole === 'influencer') {
          const { data: existingProfile } = await supabase
            .from('influencer_profiles')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (!existingProfile) {
            const user = users.find(u => u.id === userId);
            const { error: profileError } = await supabase
              .from('influencer_profiles')
              .insert({
                user_id: userId,
                display_name: user?.name || null,
                assigned_by: currentUser?.id,
              });
            
            if (profileError) {
              console.error('Error creating influencer profile:', profileError);
            }
          }
        }
      } else if (newRole === 'consumer') {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .in('role', ['driver', 'vendor', 'influencer']);
        
        await supabase
          .from('influencer_profiles')
          .delete()
          .eq('user_id', userId);
        
        const { data: existingConsumer } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'consumer')
          .maybeSingle();
        
        if (!existingConsumer) {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'consumer' });
          if (error) throw error;
        }
      } else if (newRole === 'admin') {
        const { data: existingAdmin } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (!existingAdmin) {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'admin' });
          if (error) throw error;
        }
      }

      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: "Role updated",
        description: `User role has been updated to ${newRole}.`
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user role",
      });
    }
  };

  const handleCreateAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: newAdminName || newAdminEmail.split('@')[0],
          }
        }
      });

      if (signUpError) throw signUpError;
      
      if (!signUpData.user) {
        throw new Error("Failed to create user");
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: signUpData.user.id, role: 'admin' });

      if (roleError) throw roleError;

      await supabase
        .from('profiles')
        .update({ role: 'admin', name: newAdminName || newAdminEmail.split('@')[0] })
        .eq('id', signUpData.user.id);

      toast({
        title: "Admin created",
        description: "New admin user has been created. They may need to verify their email.",
      });

      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminName("");
      setIsDialogOpen(false);
      
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create admin user",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Admin User</DialogTitle>
              <DialogDescription>
                Enter the details for the new admin user. They will receive an email to verify their account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Admin Name"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search by Email */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
        {searchEmail && (
          <Button variant="outline" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
      </div>
      
      <Table>
        <TableCaption>
          {searchEmail ? `Search results for "${searchEmail}"` : "List of all registered users"}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Spent</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {searchEmail ? "No users found matching that email" : "No users found"}
              </TableCell>
            </TableRow>
          ) : (
            users.map(user => (
              <TableRow key={user.id} className={user.is_banned ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name || 'No name'}</div>
                      {user.influencer_username && (
                        <div className="text-xs text-primary">@{user.influencer_username}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.phone || 'No phone'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'vendor' ? 'outline' : 'default'}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.is_banned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{user.totalOrders ?? 0}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">R {(user.totalSpent ?? 0).toFixed(2)}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{new Date(user.created_at).toLocaleDateString()}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(user)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.role !== 'admin' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'admin')}>
                            Make Admin
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'vendor' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'vendor')}>
                            Make Vendor
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'driver' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'driver')}>
                            Make Driver
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'influencer' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'influencer')}>
                            Make Influencer
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'consumer' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'consumer')}>
                            Make Consumer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {user.is_banned ? (
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setIsUnbanDialogOpen(true);
                            }}
                            className="text-green-600"
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Unban User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedUser(user);
                              setIsBanDialogOpen(true);
                            }}
                            className="text-orange-600"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Ban User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Action Dialogs */}
      <BanUserDialog
        open={isBanDialogOpen}
        onOpenChange={setIsBanDialogOpen}
        onConfirm={handleBanUser}
        isLoading={isProcessing}
        userName={selectedUser?.name || selectedUser?.email}
      />
      <UnbanUserDialog
        open={isUnbanDialogOpen}
        onOpenChange={setIsUnbanDialogOpen}
        onConfirm={handleUnbanUser}
        isLoading={isProcessing}
        userName={selectedUser?.name || selectedUser?.email}
      />
      <DeleteUserDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteUser}
        isLoading={isProcessing}
        userName={selectedUser?.name || selectedUser?.email}
      />
      
      {/* User Details Dialog */}
      <UserDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        user={detailsUser}
        isLoading={isLoadingDetails}
      />
    </div>
  );
};

export default AdminUsers;
