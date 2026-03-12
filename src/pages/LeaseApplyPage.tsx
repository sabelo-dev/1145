import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import LeaseApplicationForm from "@/components/leasing/LeaseApplicationForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LeaseApplyPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    
    const fetchAsset = async () => {
      if (!assetId) return;
      const { data } = await supabase
        .from("leaseable_assets")
        .select("*")
        .eq("id", assetId)
        .single();

      if (data) setAsset(data);
      setLoading(false);
    };

    fetchAsset();
  }, [assetId, user, navigate]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Asset Not Found</h1>
        <p className="text-muted-foreground mb-6">The lease asset you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/shop")}>Browse Products</Button>
      </div>
    );
  }

  const productName = (location.state as any)?.productName || asset.title;
  const productImage = asset.images?.[0] || (location.state as any)?.productImage;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
      <LeaseApplicationForm asset={asset} productName={productName} productImage={productImage} />
    </div>
  );
};

export default LeaseApplyPage;
