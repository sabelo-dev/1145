import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, CreditCard, Plus, Trash2, Star, ArrowUpDown, Coins, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";
import { ReferralDashboard } from "@/components/referral/ReferralDashboard";

const ConsumerWallet: React.FC = () => {
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Mock data - replace with actual API calls
  const walletBalance = {
    storeCredit: 150.00,
    loyaltyPoints: 1250,
    pointsValue: 12.50 // 1 point = R0.01
  };

  const savedCards = [
    {
      id: "1",
      type: "visa",
      lastFour: "4242",
      expiryMonth: "12",
      expiryYear: "2025",
      isDefault: true
    },
    {
      id: "2",
      type: "mastercard",
      lastFour: "5555",
      expiryMonth: "08",
      expiryYear: "2026",
      isDefault: false
    }
  ];

  const transactions = [
    {
      id: "1",
      type: "purchase",
      description: "Order ORD-001 - Wireless Headphones",
      amount: -1299.99,
      method: "Visa •••• 4242",
      date: "2024-01-15",
      status: "completed"
    },
    {
      id: "2",
      type: "refund",
      description: "Refund for Order ORD-003",
      amount: 299.99,
      method: "Store Credit",
      date: "2024-01-12",
      status: "completed"
    },
    {
      id: "3",
      type: "loyalty_earned",
      description: "Loyalty points earned from Order ORD-001",
      amount: 65, // points
      method: "Loyalty Program",
      date: "2024-01-15",
      status: "completed"
    },
    {
      id: "4",
      type: "loyalty_redeemed",
      description: "Points redeemed for 10% discount",
      amount: -100, // points
      method: "Loyalty Program",
      date: "2024-01-10",
      status: "completed"
    }
  ];

  const getCardIcon = (type: string) => {
    // In a real app, you'd use actual card brand icons
    return <CreditCard className="h-6 w-6" />;
  };

  const formatAmount = (amount: number, type: string) => {
    if (type.includes('loyalty')) {
      return `${amount > 0 ? '+' : ''}${amount} pts`;
    }
    return `${amount > 0 ? '+' : ''}R${Math.abs(amount).toFixed(2)}`;
  };

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

      {/* Wallet Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Store Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{walletBalance.storeCredit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Available for purchases
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Loyalty Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <Star className="h-5 w-5 text-yellow-400" />
              {walletBalance.loyaltyPoints}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Worth R{walletBalance.pointsValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R{(walletBalance.storeCredit + walletBalance.pointsValue).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Saved Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Saved Payment Methods</CardTitle>
            <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Card
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Card Number</label>
                    <Input placeholder="1234 5678 9012 3456" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Expiry Date</label>
                      <Input placeholder="MM/YY" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">CVV</label>
                      <Input placeholder="123" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cardholder Name</label>
                    <Input placeholder="John Doe" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="setDefault" />
                    <label htmlFor="setDefault" className="text-sm">
                      Set as default payment method
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsAddCardOpen(false)}>Add Card</Button>
                    <Button variant="outline" onClick={() => setIsAddCardOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {savedCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getCardIcon(card.type)}
                  <div>
                    <div className="font-medium">
                      {card.type.charAt(0).toUpperCase() + card.type.slice(1)} •••• {card.lastFour}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expires {card.expiryMonth}/{card.expiryYear}
                    </div>
                  </div>
                  {card.isDefault && (
                    <Badge variant="default">Default</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{transaction.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.date} • {transaction.method}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {formatAmount(transaction.amount, transaction.type)}
                  </div>
                  <Badge 
                    variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {transaction.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerWallet;