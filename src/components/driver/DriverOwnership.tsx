import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Car,
  Store,
  TrendingUp,
  Coins,
  Plus,
  PiggyBank,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import type { DriverInvestment, DriverVehicleFund } from '@/types/driver';

interface DriverOwnershipProps {
  investments: DriverInvestment[];
  vehicleFund: DriverVehicleFund | null;
  availableBalance: number;
  onCreateInvestment: (
    type: 'brand_stake' | 'vehicle_savings' | 'storefront_fund',
    amount: number,
    ucoinAmount?: number,
    targetVendorId?: string
  ) => Promise<boolean>;
  onContributeToVehicleFund: (amount: number, ucoinAmount?: number) => Promise<boolean>;
}

const DriverOwnership: React.FC<DriverOwnershipProps> = ({
  investments,
  vehicleFund,
  availableBalance,
  onCreateInvestment,
  onContributeToVehicleFund,
}) => {
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [vehicleFundDialogOpen, setVehicleFundDialogOpen] = useState(false);
  const [investmentType, setInvestmentType] = useState<
    'brand_stake' | 'vehicle_savings' | 'storefront_fund'
  >('brand_stake');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateInvestment = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const success = await onCreateInvestment(investmentType, parseFloat(amount));
    setLoading(false);
    if (success) {
      setInvestmentDialogOpen(false);
      setAmount('');
    }
  };

  const handleContributeToVehicleFund = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    const success = await onContributeToVehicleFund(parseFloat(amount));
    setLoading(false);
    if (success) {
      setVehicleFundDialogOpen(false);
      setAmount('');
    }
  };

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalReturns = investments.reduce((sum, inv) => sum + inv.returns_earned, 0);

  const getInvestmentIcon = (type: string) => {
    switch (type) {
      case 'brand_stake':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'vehicle_savings':
        return <Car className="h-5 w-5 text-blue-500" />;
      case 'storefront_fund':
        return <Store className="h-5 w-5 text-purple-500" />;
      default:
        return <Coins className="h-5 w-5 text-primary" />;
    }
  };

  const getInvestmentLabel = (type: string) => {
    switch (type) {
      case 'brand_stake':
        return 'Brand Investment';
      case 'vehicle_savings':
        return 'Vehicle Savings';
      case 'storefront_fund':
        return 'Storefront Fund';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold">R{totalInvested.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <ArrowUpRight className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Returns</p>
                <p className="text-2xl font-bold">R{totalReturns.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Car className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vehicle Fund</p>
                <p className="text-2xl font-bold">R{vehicleFund?.total_saved.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Fund */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Fund
              </CardTitle>
              <CardDescription>
                Save for vehicle maintenance, upgrades, or a new vehicle
              </CardDescription>
            </div>
            <Dialog open={vehicleFundDialogOpen} onOpenChange={setVehicleFundDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Contribute
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Contribute to Vehicle Fund</DialogTitle>
                  <DialogDescription>
                    Add money to your vehicle fund from your available balance
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Amount (R)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: R{availableBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVehicleFundDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleContributeToVehicleFund} disabled={loading}>
                    {loading ? 'Contributing...' : 'Contribute'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {vehicleFund ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Savings Progress</span>
                <span className="text-sm text-muted-foreground">
                  R{vehicleFund.total_saved.toFixed(2)}
                  {vehicleFund.target_amount && (
                    <> / R{vehicleFund.target_amount.toFixed(2)}</>
                  )}
                </span>
              </div>
              {vehicleFund.target_amount && (
                <Progress
                  value={(vehicleFund.total_saved / vehicleFund.target_amount) * 100}
                  className="h-3"
                />
              )}
              {vehicleFund.purpose && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Purpose: {vehicleFund.purpose}
                  </span>
                </div>
              )}
              {vehicleFund.ucoin_contributed > 0 && (
                <Badge variant="secondary">
                  <Coins className="h-3 w-3 mr-1" />
                  {vehicleFund.ucoin_contributed} UCoins contributed
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No vehicle fund started yet</p>
              <p className="text-sm">Start saving for your vehicle needs</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                My Investments
              </CardTitle>
              <CardDescription>
                Invest in brands or save for your own storefront
              </CardDescription>
            </div>
            <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Investment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Investment</DialogTitle>
                  <DialogDescription>
                    Choose an investment type and amount
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Investment Type</Label>
                    <Select
                      value={investmentType}
                      onValueChange={(v: any) => setInvestmentType(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brand_stake">Brand Investment</SelectItem>
                        <SelectItem value="vehicle_savings">Vehicle Savings</SelectItem>
                        <SelectItem value="storefront_fund">Storefront Fund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (R)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: R{availableBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInvestmentDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateInvestment} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Investment'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No investments yet</p>
              <p className="text-sm">Start investing to grow your wealth</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investments.map((investment) => (
                <div
                  key={investment.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-background">
                      {getInvestmentIcon(investment.investment_type)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {getInvestmentLabel(investment.investment_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(investment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R{investment.amount.toFixed(2)}</p>
                    {investment.returns_earned > 0 && (
                      <p className="text-xs text-green-500">
                        +R{investment.returns_earned.toFixed(2)} returns
                      </p>
                    )}
                    <Badge
                      variant={investment.status === 'active' ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {investment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storefront CTA */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-primary/10 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Store className="h-8 w-8 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Open Your Own Store</h3>
              <p className="text-sm text-muted-foreground">
                Use your earnings and investments to become a vendor and open your own storefront
              </p>
            </div>
            <Button variant="outline" className="border-purple-500/50">
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverOwnership;
