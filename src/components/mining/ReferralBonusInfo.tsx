import { Users, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ReferralBonusInfo() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Referral Mining Bonus
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Earn bonus UCoin when your referrals mine!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-sm">Direct Referrals</p>
                <p className="text-xs text-muted-foreground">People you referred</p>
              </div>
            </div>
            <span className="text-lg font-bold text-primary">10%</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-sm font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-sm">Second Level</p>
                <p className="text-xs text-muted-foreground">Your referrals' referrals</p>
              </div>
            </div>
            <span className="text-lg font-bold">3%</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-sm">Third Level</p>
                <p className="text-xs text-muted-foreground">Extended network</p>
              </div>
            </div>
            <span className="text-lg font-bold text-muted-foreground">1%</span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg border border-dashed">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>Build your network to maximize passive UCoin earnings!</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
