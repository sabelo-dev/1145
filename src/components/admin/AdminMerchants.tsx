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
import AddMerchantDialog from "@/components/admin/merchants/AddMerchantDialog";
import EditMerchantSubscriptionDialog from "@/components/admin/merchants/EditMerchantSubscriptionDialog";
import DeleteMerchantDialog from "@/components/admin/merchants/DeleteMerchantDialog";

interface Merchant {
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

const AdminMerchants: React.FC = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingMerchant, setDeletingMerchant] = useState<Merchant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const { data: merchantsData, error } = await supabase
        .from('merchants')
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
            business_address,
            website,
            custom_markup_percentage
          `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching merchants:', error);
        throw error;
      }

      // Get all unique user IDs
      const userIds = [...new Set(merchantsData?.map((v) => v.user_id) || [])];
      const merchantIds = (merchantsData || []).map((v) => v.id);

      // Fetch all profiles in one query
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      // Fetch financial details (admin RLS allows all)
      const { data: finData } = await supabase
        .from('merchant_financial_details')
        .select('merchant_id, business_email, business_phone, tax_id')
        .in('merchant_id', merchantIds);

      // Create a map for quick lookup
      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));
      const finMap = new Map((finData || []).map((f) => [f.merchant_id, f]));

      const formattedMerchants = (merchantsData || []).map((merchant) => ({
        ...merchant,
        status: merchant.status as "pending" | "approved" | "rejected" | "suspended",
        profiles: profilesMap.get(merchant.user_id),
        business_email: finMap.get(merchant.id)?.business_email,
        business_phone: finMap.get(merchant.id)?.business_phone,
        tax_id: finMap.get(merchant.id)?.tax_id,
      }));

      setMerchants(formattedMerchants);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load merchants: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch merchants from database
  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  const handleUpdateStatus = async (merchantId: string, newStatus: "approved" | "rejected" | "suspended") => {
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ 
          status: newStatus,
          approval_date: newStatus === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', merchantId);

      if (error) throw error;

      setMerchants(
        merchants.map((merchant) =>
          merchant.id === merchantId ? { ...merchant, status: newStatus } : merchant
        )
      );

      toast({
        title: "Merchant status updated",
        description: `Merchant has been ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating merchant status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update merchant status.",
      });
    }
  };

  const handleRemoveMerchant = async (merchantId: string) => {
    try {
      const { error } = await supabase.rpc('delete_merchant_cascade', {
        merchant_uuid: merchantId
      });

      if (error) throw error;

      setMerchants(merchants.filter((merchant) => merchant.id !== merchantId));

      toast({
        title: "Merchant removed",
        description: "Merchant and all associated data have been permanently deleted.",
      });
    } catch (error) {
      console.error('Error removing merchant:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to remove merchant: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const handleDeleteClick = (merchant: Merchant) => {
    setDeletingMerchant(merchant);
    setDeleteDialogOpen(true);
  };

  const getTierBadgeColor = (tier: string | undefined) => {
    switch (tier) {
      case "gold": return "bg-gold/10 text-black";
      case "silver": return "bg-slate-400 text-white";
      case "bronze": return "bg-gold text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const handleEditSubscription = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setEditDialogOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Merchant Applications</h2>
        <AddMerchantDialog onCreated={fetchMerchants} />
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
            {merchants.map((merchant) => (
              <TableRow key={merchant.id}>
                <TableCell className="font-medium">{merchant.business_name}</TableCell>
                <TableCell>{merchant.business_email || 'N/A'}</TableCell>
                <TableCell>
                  <Badge className={getTierBadgeColor(merchant.subscription_tier)}>
                    {(merchant.subscription_tier || 'starter').charAt(0).toUpperCase() + (merchant.subscription_tier || 'starter').slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {merchant.subscription_status || 'trial'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={merchant.custom_markup_percentage !== null && merchant.custom_markup_percentage !== undefined ? "font-medium text-primary" : "text-muted-foreground"}>
                    {merchant.custom_markup_percentage !== null && merchant.custom_markup_percentage !== undefined
                      ? `${merchant.custom_markup_percentage}%`
                      : `${DEFAULT_PLATFORM_MARKUP_PERCENTAGE}%`}
                  </span>
                  {merchant.custom_markup_percentage !== null && merchant.custom_markup_percentage !== undefined && (
                    <Badge variant="outline" className="ml-1 text-[11px]">Custom</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      merchant.status === "approved"
                        ? "default"
                        : merchant.status === "rejected"
                        ? "destructive"
                        : merchant.status === "suspended"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {merchant.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(merchant.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSubscription(merchant)}
                      title="Edit Subscription"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    {merchant.status === "pending" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleUpdateStatus(merchant.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUpdateStatus(merchant.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {merchant.status === "approved" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUpdateStatus(merchant.id, "suspended")}
                      >
                        Suspend
                      </Button>
                    )}
                    {merchant.status === "suspended" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(merchant.id, "approved")}
                      >
                        Reactivate
                      </Button>
                    )}
                    {merchant.status === "rejected" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUpdateStatus(merchant.id, "approved")}
                      >
                        Approve
                      </Button>
                    )}
                    {merchant.status !== "pending" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(merchant)}
                        title="Delete Merchant"
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

      <EditMerchantSubscriptionDialog
        merchant={editingMerchant}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={fetchMerchants}
      />

      <DeleteMerchantDialog
        merchant={deletingMerchant}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemoveMerchant}
      />
    </div>
  );
};

export default AdminMerchants;

