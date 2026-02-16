import React, { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_PLATFORM_MARKUP_PERCENTAGE } from "@/utils/pricingMarkup";
import { supabase } from "@/integrations/supabase/client";
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
import { Settings2, Trash2 } from "lucide-react";
import AddVendorDialog from "@/components/admin/vendors/AddVendorDialog";
import EditVendorSubscriptionDialog from "@/components/admin/vendors/EditVendorSubscriptionDialog";
import DeleteVendorDialog from "@/components/admin/vendors/DeleteVendorDialog";

interface Vendor {
  id: string;
  business_name: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
  description?: string;
  logo_url?: string;
  subscription_tier?: string;
  subscription_status?: string;
  trial_end_date?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  website?: string;
  tax_id?: string;
  custom_markup_percentage?: number | null;
  profiles?: {
    email: string;
    name?: string;
  };
}

const AdminVendors: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vendorsData, error } = await supabase
        .from('vendors')
        .select(`
            id,
            business_name,
            user_id,
            status,
            created_at,
            description,
            logo_url,
            subscription_tier,
            subscription_status,
            trial_end_date,
            business_email,
            business_phone,
            business_address,
            website,
            tax_id,
            custom_markup_percentage
          `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching vendors:', error);
        throw error;
      }

      // Get all unique user IDs
      const userIds = [...new Set(vendorsData?.map((v) => v.user_id) || [])];

      // Fetch all profiles in one query
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      // Create a map for quick lookup
      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

      const formattedVendors = (vendorsData || []).map((vendor) => ({
        ...vendor,
        status: vendor.status as "pending" | "approved" | "rejected" | "suspended",
        profiles: profilesMap.get(vendor.user_id),
      }));

      setVendors(formattedVendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load vendors: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch vendors from database
  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleUpdateStatus = async (vendorId: string, newStatus: "approved" | "rejected" | "suspended") => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ 
          status: newStatus,
          approval_date: newStatus === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', vendorId);

      if (error) throw error;

      setVendors(
        vendors.map((vendor) =>
          vendor.id === vendorId ? { ...vendor, status: newStatus } : vendor
        )
      );

      toast({
        title: "Merchant status updated",
        description: `Merchant has been ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update merchant status.",
      });
    }
  };

  const handleRemoveVendor = async (vendorId: string) => {
    try {
      const { error } = await supabase.rpc('delete_vendor_cascade', {
        vendor_uuid: vendorId
      });

      if (error) throw error;

      setVendors(vendors.filter((vendor) => vendor.id !== vendorId));

      toast({
        title: "Merchant removed",
        description: "Merchant and all associated data have been permanently deleted.",
      });
    } catch (error) {
      console.error('Error removing vendor:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to remove vendor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const handleDeleteClick = (vendor: Vendor) => {
    setDeletingVendor(vendor);
    setDeleteDialogOpen(true);
  };

  const getTierBadgeColor = (tier: string | undefined) => {
    switch (tier) {
      case "gold": return "bg-yellow-500 text-black";
      case "silver": return "bg-slate-400 text-white";
      case "bronze": return "bg-amber-700 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const handleEditSubscription = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditDialogOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Merchant Applications</h2>
        <AddVendorDialog onCreated={fetchVendors} />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading merchants...</div>
      ) : (
        <Table>
          <TableCaption>List of merchant applications</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Business Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Sub Status</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.business_name}</TableCell>
                <TableCell>{vendor.business_email || 'N/A'}</TableCell>
                <TableCell>
                  <Badge className={getTierBadgeColor(vendor.subscription_tier)}>
                    {(vendor.subscription_tier || 'starter').charAt(0).toUpperCase() + (vendor.subscription_tier || 'starter').slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {vendor.subscription_status || 'trial'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={vendor.custom_markup_percentage !== null && vendor.custom_markup_percentage !== undefined ? "font-medium text-primary" : "text-muted-foreground"}>
                    {vendor.custom_markup_percentage !== null && vendor.custom_markup_percentage !== undefined
                      ? `${vendor.custom_markup_percentage}%`
                      : `${DEFAULT_PLATFORM_MARKUP_PERCENTAGE}%`}
                  </span>
                  {vendor.custom_markup_percentage !== null && vendor.custom_markup_percentage !== undefined && (
                    <Badge variant="outline" className="ml-1 text-[10px]">Custom</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      vendor.status === "approved"
                        ? "default"
                        : vendor.status === "rejected"
                        ? "destructive"
                        : vendor.status === "suspended"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {vendor.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(vendor.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSubscription(vendor)}
                      title="Edit Subscription"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    {vendor.status === "pending" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleUpdateStatus(vendor.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUpdateStatus(vendor.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {vendor.status === "approved" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUpdateStatus(vendor.id, "suspended")}
                      >
                        Suspend
                      </Button>
                    )}
                    {vendor.status === "suspended" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(vendor.id, "approved")}
                      >
                        Reactivate
                      </Button>
                    )}
                    {vendor.status === "rejected" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(vendor.id, "approved")}
                      >
                        Approve
                      </Button>
                    )}
                    {vendor.status !== "pending" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(vendor)}
                        title="Delete Vendor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EditVendorSubscriptionDialog
        vendor={editingVendor}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={fetchVendors}
      />

      <DeleteVendorDialog
        vendor={deletingVendor}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemoveVendor}
      />
    </div>
  );
};

export default AdminVendors;

