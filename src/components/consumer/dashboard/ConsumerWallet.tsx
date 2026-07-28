import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, CreditCard, Coins, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";
import { ReferralDashboard } from "@/components/referral/ReferralDashboard";

const ConsumerWallet: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5" />
        <span className="text-lg font-medium">Wallet & Payments</span>
      </div>

      <Tabs defaultValue="ucoin" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ucoin" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            UCoin
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ucoin" className="mt-4">
          <UCoinDashboard />
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <ReferralDashboard />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Saved Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No saved payment methods yet. Cards you use at checkout with PayFast will appear here.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Your order and refund history will appear here once you make your first purchase.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerWallet;
