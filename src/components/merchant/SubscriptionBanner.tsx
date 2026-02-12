import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Crown, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionBannerProps {
  vendorId?: string;
}

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({ vendorId }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!vendorId) return;

      try {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('subscription_tier, trial_end_date, subscription_status')
          .eq('id', vendorId)
          .single();

        if (vendor) {
          setSubscription(vendor);
          
          if (vendor.trial_end_date) {
            const endDate = new Date(vendor.trial_end_date);
            const now = new Date();
            const timeDiff = endDate.getTime() - now.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            setDaysLeft(daysDiff);
            setIsExpired(daysDiff <= 0 && vendor.subscription_tier === 'trial');
          }
        }
      } catch (error) {
        console.error('Error fetching subscription data:', error);
      }
    };

    fetchSubscriptionData();
  }, [vendorId]);

  if (!subscription) return null;

  if (isExpired) {
    return (
      <Card className="border-destructive bg-destructive/5 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Trial Expired - Upgrade Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Your trial period has ended. Upgrade to continue accessing your vendor dashboard.
          </p>
          <Button className="w-full sm:w-auto">
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (subscription.subscription_tier === 'trial' && daysLeft <= 7) {
    return (
      <Card className="border-warning bg-warning/5 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Trial Ending Soon
            <Badge variant="outline" className="ml-auto">
              {daysLeft} days left
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Your trial expires in {daysLeft} days. Upgrade to continue enjoying all features.
          </p>
          <Button variant="outline" className="w-full sm:w-auto">
            View Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (subscription.subscription_tier === 'premium') {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium Plan
            <Badge className="ml-auto">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You're enjoying all premium features. Thank you for your business!
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default SubscriptionBanner;