import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, Award, Medal, Star } from "lucide-react";
import { StorefrontTier } from "@/types/storefront";

interface LockedFeatureCardProps {
  title: string;
  description: string;
  requiredTier: StorefrontTier;
  currentTier: StorefrontTier;
  children?: React.ReactNode;
}

const tierOrder: StorefrontTier[] = ['starter', 'bronze', 'silver', 'gold'];
const tierIcons: Record<StorefrontTier, React.ReactNode> = {
  starter: <Star className="h-4 w-4" />,
  bronze: <Medal className="h-4 w-4" />,
  silver: <Award className="h-4 w-4" />,
  gold: <Crown className="h-4 w-4" />,
};
const tierLabels: Record<StorefrontTier, string> = {
  starter: 'Free',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

const LockedFeatureCard: React.FC<LockedFeatureCardProps> = ({
  title,
  description,
  requiredTier,
  currentTier,
  children,
}) => {
  const currentIndex = tierOrder.indexOf(currentTier);
  const requiredIndex = tierOrder.indexOf(requiredTier);
  const isLocked = currentIndex < requiredIndex;

  if (isLocked) {
    return (
      <Card className="relative overflow-hidden opacity-60 border-dashed">
        <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="text-center p-4">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-semibold text-foreground mb-1">{title}</p>
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
            <Badge variant="outline" className="gap-1">
              {tierIcons[requiredTier]}
              Upgrade to {tierLabels[requiredTier]} to unlock
            </Badge>
          </div>
        </div>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[100px]" />
      </Card>
    );
  }

  return <>{children}</>;
};

export default LockedFeatureCard;
