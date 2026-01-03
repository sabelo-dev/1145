import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Infinity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionPlan } from "@/types/subscription";

interface SubscriptionPlansProps {
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  currentTier?: string;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  onSelectPlan, 
  currentTier = 'standard' 
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('price', { ascending: true });

        if (error) throw error;
        setPlans((data || []) as SubscriptionPlan[]);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading) {
    return <div className="grid gap-6 md:grid-cols-2">
      {[1, 2].map(i => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="h-24 bg-muted"></CardHeader>
          <CardContent className="h-48 bg-muted/50"></CardContent>
        </Card>
      ))}
    </div>;
  }

  const getIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'premium':
        return <Crown className="h-6 w-6 text-primary" />;
      case 'standard':
        return <Star className="h-6 w-6" />;
      default:
        return <Star className="h-6 w-6" />;
    }
  };

  const isCurrentPlan = (planName: string) => {
    return planName.toLowerCase() === currentTier.toLowerCase();
  };

  const getButtonText = (planName: string) => {
    if (isCurrentPlan(planName)) return 'Current Plan';
    if (planName.toLowerCase() === 'premium') return 'Upgrade to Premium';
    return 'Select Plan';
  };

  const renderFeatureValue = (feature: string) => {
    if (feature.toLowerCase().includes('unlimited')) {
      return (
        <span className="flex items-center gap-1">
          <Infinity className="h-4 w-4 text-primary" />
          {feature}
        </span>
      );
    }
    return feature;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {plans.map((plan) => {
        const isPremium = plan.name.toLowerCase() === 'premium';
        
        return (
          <Card 
            key={plan.id} 
            className={`relative ${
              isPremium 
                ? 'border-primary ring-2 ring-primary/20' 
                : ''
            } ${isCurrentPlan(plan.name) ? 'ring-2 ring-primary' : ''}`}
          >
            {isPremium && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                Recommended
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getIcon(plan.name)}
                <CardTitle className="text-xl">{plan.name}</CardTitle>
              </div>
              {isCurrentPlan(plan.name) && (
                <Badge variant="outline" className="mx-auto mb-2">Current Plan</Badge>
              )}
              <div className="text-3xl font-bold">
                {plan.price === 0 ? (
                  'Free'
                ) : (
                  <>
                    R{plan.price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{plan.billing_period}
                    </span>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isPremium ? 'For growth-focused sellers' : 'Perfect for getting started'}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {renderFeatureValue(feature)}
                  </li>
                ))}
                
                {plan.max_products && (
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    Up to {plan.max_products} products
                  </li>
                )}
                
                {!plan.max_products && isPremium && (
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="flex items-center gap-1">
                      <Infinity className="h-4 w-4 text-primary" />
                      Unlimited products
                    </span>
                  </li>
                )}
              </ul>
              
              <Button 
                className={`w-full ${isPremium && !isCurrentPlan(plan.name) ? 'gap-1' : ''}`}
                variant={isCurrentPlan(plan.name) ? "outline" : isPremium ? "default" : "secondary"}
                disabled={isCurrentPlan(plan.name)}
                onClick={() => onSelectPlan?.(plan)}
              >
                {isPremium && !isCurrentPlan(plan.name) && <Crown className="h-4 w-4" />}
                {getButtonText(plan.name)}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SubscriptionPlans;
