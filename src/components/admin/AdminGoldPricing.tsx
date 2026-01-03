import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Coins, Globe, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { GoldPriceIndicator } from '@/components/gold';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface GoldPrice {
  id: string;
  price_per_oz_usd: number;
  price_per_gram_usd: number;
  price_per_mg_usd: number;
  fetched_at: string;
  source: string;
  is_current: boolean;
}

interface CurrencyRate {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  rate_to_usd: number;
  is_active: boolean;
  updated_at: string;
}

export default function AdminGoldPricing() {
  const [goldPrices, setGoldPrices] = useState<GoldPrice[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoldPrice, setNewGoldPrice] = useState('');
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState({
    code: '',
    name: '',
    symbol: '',
    rate: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [goldRes, currencyRes] = await Promise.all([
      supabase.from('gold_price_cache').select('*').order('fetched_at', { ascending: false }).limit(10),
      supabase.from('currency_rates').select('*').order('currency_code'),
    ]);

    if (goldRes.data) {
      setGoldPrices(goldRes.data.map(g => ({
        ...g,
        price_per_oz_usd: parseFloat(String(g.price_per_oz_usd)),
        price_per_gram_usd: parseFloat(String(g.price_per_gram_usd)),
        price_per_mg_usd: parseFloat(String(g.price_per_mg_usd)),
      })));
    }
    if (currencyRes.data) {
      setCurrencies(currencyRes.data.map(c => ({
        ...c,
        rate_to_usd: parseFloat(String(c.rate_to_usd)),
      })));
    }
    setLoading(false);
  };

  const updateGoldPrice = async () => {
    const pricePerOz = parseFloat(newGoldPrice);
    if (isNaN(pricePerOz) || pricePerOz <= 0) {
      toast({ title: 'Invalid price', variant: 'destructive' });
      return;
    }

    const pricePerGram = pricePerOz / 31.1034768;
    const pricePerMg = pricePerGram / 1000;

    // Mark current as not current
    await supabase.from('gold_price_cache').update({ is_current: false }).eq('is_current', true);

    // Insert new price
    const { error } = await supabase.from('gold_price_cache').insert({
      price_per_oz_usd: pricePerOz,
      price_per_gram_usd: pricePerGram,
      price_per_mg_usd: pricePerMg,
      source: 'admin_manual',
      is_current: true,
    });

    if (error) {
      toast({ title: 'Failed to update gold price', variant: 'destructive' });
    } else {
      toast({ title: 'Gold price updated successfully' });
      setNewGoldPrice('');
      fetchData();
    }
  };

  const updateCurrencyRate = async (id: string, newRate: number) => {
    const { error } = await supabase
      .from('currency_rates')
      .update({ rate_to_usd: newRate, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Failed to update rate', variant: 'destructive' });
    } else {
      toast({ title: 'Currency rate updated' });
      fetchData();
    }
  };

  const toggleCurrencyActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('currency_rates')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      toast({ title: `Currency ${isActive ? 'disabled' : 'enabled'}` });
      fetchData();
    }
  };

  const addCurrency = async () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol || !newCurrency.rate) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('currency_rates').insert({
      currency_code: newCurrency.code.toUpperCase(),
      currency_name: newCurrency.name,
      currency_symbol: newCurrency.symbol,
      rate_to_usd: parseFloat(newCurrency.rate),
    });

    if (error) {
      toast({ title: 'Failed to add currency', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Currency added successfully' });
      setNewCurrency({ code: '', name: '', symbol: '', rate: '' });
      setAddCurrencyOpen(false);
      fetchData();
    }
  };

  const currentGoldPrice = goldPrices.find(g => g.is_current);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gold Pricing System</h2>
          <p className="text-muted-foreground">Manage gold prices and currency exchange rates</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Current Gold Price Card */}
      <GoldPriceIndicator showDetails className="max-w-md" />

      <Tabs defaultValue="gold" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gold" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Gold Prices
          </TabsTrigger>
          <TabsTrigger value="currencies" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Currencies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gold" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Update Gold Price</CardTitle>
              <CardDescription>Set the current gold price per troy ounce in USD</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="goldPrice">Price per oz (USD)</Label>
                  <Input
                    id="goldPrice"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 2650.00"
                    value={newGoldPrice}
                    onChange={(e) => setNewGoldPrice(e.target.value)}
                  />
                </div>
                <Button onClick={updateGoldPrice}>
                  <Save className="h-4 w-4 mr-2" />
                  Update Price
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price/oz</TableHead>
                    <TableHead>Price/g</TableHead>
                    <TableHead>Price/mg</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goldPrices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell className="font-medium">${price.price_per_oz_usd.toFixed(2)}</TableCell>
                      <TableCell>${price.price_per_gram_usd.toFixed(4)}</TableCell>
                      <TableCell>${price.price_per_mg_usd.toFixed(8)}</TableCell>
                      <TableCell className="capitalize">{price.source.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{format(new Date(price.fetched_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell>
                        {price.is_current ? (
                          <Badge className="bg-green-500">Current</Badge>
                        ) : (
                          <Badge variant="secondary">Historical</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currencies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Currency Exchange Rates</CardTitle>
                <CardDescription>Rates relative to 1 USD</CardDescription>
              </div>
              <Dialog open={addCurrencyOpen} onOpenChange={setAddCurrencyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Currency
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Currency</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Currency Code</Label>
                      <Input
                        placeholder="e.g. USD"
                        value={newCurrency.code}
                        onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Currency Name</Label>
                      <Input
                        placeholder="e.g. US Dollar"
                        value={newCurrency.name}
                        onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Symbol</Label>
                      <Input
                        placeholder="e.g. $"
                        value={newCurrency.symbol}
                        onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Rate to USD</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="e.g. 18.5"
                        value={newCurrency.rate}
                        onChange={(e) => setNewCurrency({ ...newCurrency, rate: e.target.value })}
                      />
                    </div>
                    <Button onClick={addCurrency} className="w-full">Add Currency</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Rate to USD</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-medium">{currency.currency_code}</TableCell>
                      <TableCell>{currency.currency_name}</TableCell>
                      <TableCell>{currency.currency_symbol}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.000001"
                          defaultValue={currency.rate_to_usd}
                          className="w-28 h-8"
                          onBlur={(e) => {
                            const newRate = parseFloat(e.target.value);
                            if (!isNaN(newRate) && newRate !== currency.rate_to_usd) {
                              updateCurrencyRate(currency.id, newRate);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(currency.updated_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>
                        <Badge variant={currency.is_active ? 'default' : 'secondary'}>
                          {currency.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCurrencyActive(currency.id, currency.is_active)}
                        >
                          {currency.is_active ? 'Disable' : 'Enable'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
