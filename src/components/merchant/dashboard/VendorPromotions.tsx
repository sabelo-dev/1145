import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Tag,
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  Percent
} from "lucide-react";

const VendorPromotions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "percentage",
    value: "",
    minOrderValue: "",
    usageLimit: "",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    if (user?.id) {
      fetchPromotions();
    }
  }, [user?.id]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;

      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id);

      if (storesError) throw storesError;

      const storeIds = stores.map(store => store.id);

      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .in('store_id', storeIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPromotions(data || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch promotions"
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdatePromotion = async () => {
    if (!formData.name || !formData.code || !formData.value || !formData.startDate || !formData.endDate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id)
        .single();

      const promotionData = {
        store_id: store.id,
        name: formData.name,
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        min_order_value: formData.minOrderValue ? parseFloat(formData.minOrderValue) : 0,
        usage_limit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        start_date: formData.startDate,
        end_date: formData.endDate,
        status: 'active'
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id);

        if (error) throw error;
        
        toast({
          title: "Promotion updated",
          description: "Your promotion has been updated successfully."
        });
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert([promotionData]);

        if (error) throw error;
        
        toast({
          title: "Promotion created",
          description: "Your new promotion has been created successfully."
        });
      }

      await fetchPromotions();
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating/updating promotion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save promotion"
      });
    }
  };

  const deletePromotion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPromotions(promotions.filter(p => p.id !== id));
      
      toast({
        title: "Promotion deleted",
        description: "The promotion has been deleted successfully."
      });
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete promotion"
      });
    }
  };

  const editPromotion = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      code: promotion.code,
      type: promotion.type,
      value: promotion.value.toString(),
      minOrderValue: promotion.min_order_value?.toString() || "",
      usageLimit: promotion.usage_limit?.toString() || "",
      startDate: promotion.start_date.split('T')[0],
      endDate: promotion.end_date.split('T')[0]
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      type: "percentage",
      value: "",
      minOrderValue: "",
      usageLimit: "",
      startDate: "",
      endDate: ""
    });
    setEditingPromotion(null);
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied",
      description: "Promotion code has been copied to clipboard."
    });
  };

  const filteredPromotions = promotions.filter(promo =>
    promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    promo.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'default';
    if (status === 'expired') return 'secondary';
    return 'outline';
  };

  const formatValue = (type: string, value: number) => {
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `R${value}`;
    return 'Free Shipping';
  };

  const activeCount = promotions.filter(p => p.status === 'active').length;
  const totalUsage = promotions.reduce((sum, p) => sum + (p.usage_count || 0), 0);

  if (loading) {
    return <div>Loading promotions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promotions & Discounts</h2>
          <p className="text-muted-foreground">
            Create and manage discount codes and promotions.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPromotion ? 'Edit' : 'Create'} Promotion</DialogTitle>
              <DialogDescription>
                Set up discount codes and promotional offers for your customers.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Promotion Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Summer Sale 2024"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Promo Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    placeholder="SUMMER20"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="type">Discount Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="free_shipping">Free Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="value">
                    {formData.type === 'percentage' ? 'Percentage' : formData.type === 'fixed' ? 'Amount (R)' : 'Value'} *
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    placeholder={formData.type === 'percentage' ? '20' : '100'}
                    disabled={formData.type === 'free_shipping'}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="minOrder">Minimum Order (R)</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({...formData, minOrderValue: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="usageLimit">Usage Limit (optional)</Label>
                <Input
                  id="usageLimit"
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                  placeholder="Unlimited"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={createOrUpdatePromotion}>
                {editingPromotion ? 'Update' : 'Create'} Promotion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <p className="text-xs text-muted-foreground">Codes redeemed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promotions</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotions.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promotions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Promotions List */}
      {filteredPromotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No promotions yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first promotion to start offering discounts.</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Promotion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPromotions.map((promo) => (
            <Card key={promo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {promo.name}
                      <Badge variant={getStatusColor(promo.status)}>
                        {promo.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Code: <span className="font-mono font-bold">{promo.code}</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(promo.code)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => editPromotion(promo)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deletePromotion(promo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Discount</p>
                    <p className="font-medium">{formatValue(promo.type, promo.value)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Usage</p>
                    <p className="font-medium">
                      {promo.usage_count}/{promo.usage_limit || '∞'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Min. Order</p>
                    <p className="font-medium">R{promo.min_order_value || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorPromotions;
