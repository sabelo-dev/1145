import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Shield, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ListingType } from "@/types";

interface ProductLeaseOptionProps {
  productId: string;
  productName: string;
  listingType: ListingType;
  salePrice: number;
}

interface LeaseAssetData {
  id: string;
  lease_price_monthly: number;
  lease_price_weekly?: number;
  security_deposit: number;
  min_lease_duration_months: number;
  max_lease_duration_months?: number;
  lease_to_own?: boolean;
  lease_to_own_price?: number;
  lease_to_own_months?: number;
  insurance_required?: boolean;
  insurance_monthly_cost?: number;
  maintenance_responsibility?: string;
  condition?: string;
  is_available?: boolean;
}

const ProductLeaseOption: React.FC<ProductLeaseOptionProps> = ({
  productId,
  productName,
  listingType,
  salePrice,
}) => {
  const navigate = useNavigate();
  const [leaseAsset, setLeaseAsset] = useState<LeaseAssetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaseAsset = async () => {
      if (listingType === 'sale') { setLoading(false); return; }
      
      const { data } = await supabase
        .from("leaseable_assets")
        .select("*")
        .eq("product_id", productId)
        .eq("is_available", true)
        .maybeSingle();

      if (data) setLeaseAsset(data as any);
      setLoading(false);
    };

    fetchLeaseAsset();
  }, [productId, listingType]);

  if (listingType === 'sale' || loading || !leaseAsset) return null;

  return (
    <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Lease Option Available
        </h3>
        {leaseAsset.lease_to_own && (
          <Badge className="bg-primary/10 text-primary border-primary/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            Lease-to-Own
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Monthly</span>
          <div className="font-bold text-lg">{formatCurrency(leaseAsset.lease_price_monthly)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Deposit</span>
          <div className="font-bold text-lg">{formatCurrency(leaseAsset.security_deposit)}</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <div>Min {leaseAsset.min_lease_duration_months} months • Max {leaseAsset.max_lease_duration_months || 24} months</div>
        {leaseAsset.insurance_required && (
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" /> Insurance required ({formatCurrency(leaseAsset.insurance_monthly_cost || 0)}/mo)
          </div>
        )}
        {leaseAsset.lease_to_own && leaseAsset.lease_to_own_months && (
          <div>Own after {leaseAsset.lease_to_own_months} payments of {formatCurrency(leaseAsset.lease_price_monthly)}</div>
        )}
      </div>

      <Separator />

      <Button 
        className="w-full" 
        variant="outline"
        onClick={() => navigate(`/lease/apply/${leaseAsset.id}`, { state: { productName, productImage: undefined } })}
      >
        Apply for Lease
      </Button>
    </div>
  );
};

export default ProductLeaseOption;
