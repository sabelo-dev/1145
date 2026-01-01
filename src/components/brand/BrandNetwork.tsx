import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, Package, Handshake, Link2, Plus, Check, X, Send, Clock
} from 'lucide-react';
import { BrandBundle, CrossPromotion } from '@/types/brand';
import { cn } from '@/lib/utils';

interface BrandNetworkProps {
  bundles: BrandBundle[];
  crossPromos: CrossPromotion[];
  vendorId: string;
  onCreateBundle: (name: string, description: string, products: { productId: string; vendorId: string; discount: number }[]) => Promise<unknown>;
  onCreateCrossPromo: (partnerId: string, type: string, terms: Record<string, unknown>, products: string[]) => Promise<unknown>;
  onRespondToPromo?: (promoId: string, accept: boolean) => Promise<void>;
  onRespondToBundle?: (bundleProductId: string, accept: boolean) => Promise<void>;
  availablePartners?: { id: string; business_name: string; logo_url: string | null }[];
}

export function BrandNetwork({
  bundles,
  crossPromos,
  vendorId,
  onCreateBundle,
  onCreateCrossPromo,
  availablePartners = []
}: BrandNetworkProps) {
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const pendingPromos = crossPromos.filter(
    p => p.status === 'pending' && p.partner_vendor_id === vendorId
  );
  const activePromos = crossPromos.filter(p => p.status === 'active');
  const myInitiatedPromos = crossPromos.filter(p => p.initiator_vendor_id === vendorId);

  const handleCreateBundle = async () => {
    if (!bundleName) return;
    setIsCreating(true);
    await onCreateBundle(bundleName, bundleDescription, []);
    setIsCreating(false);
    setShowBundleDialog(false);
    setBundleName('');
    setBundleDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Pending Invitations */}
      {pendingPromos.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Partnership Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPromos.map((promo) => (
              <div key={promo.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={promo.initiator_vendor?.logo_url || undefined} />
                    <AvatarFallback>
                      {promo.initiator_vendor?.business_name?.[0] || 'B'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{promo.initiator_vendor?.business_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {promo.promo_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                  <Button size="sm">
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="bundles" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bundles" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product Bundles
          </TabsTrigger>
          <TabsTrigger value="cross-promos" className="flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            Cross-Promotions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bundles" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Product Bundles</h3>
              <p className="text-sm text-muted-foreground">
                Create bundles with other brands for shared cart discounts
              </p>
            </div>
            <Button onClick={() => setShowBundleDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>
          </div>

          {bundles.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No bundles created yet.</p>
                <p className="text-sm text-muted-foreground">
                  Create a bundle to offer combined deals with partner brands.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bundles.map((bundle) => (
                <Card key={bundle.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{bundle.name}</h4>
                        <p className="text-sm text-muted-foreground">{bundle.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bundle.status === 'active' ? 'default' : 'secondary'}>
                          {bundle.status}
                        </Badge>
                        {bundle.bundle_discount > 0 && (
                          <Badge variant="outline" className="text-green-600">
                            {bundle.bundle_discount}% off
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cross-promos" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Cross-Promotions</h3>
              <p className="text-sm text-muted-foreground">
                Partner with other brands to cross-promote products
              </p>
            </div>
            <Button onClick={() => setShowPromoDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send Request
            </Button>
          </div>

          {/* Active Partnerships */}
          {activePromos.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Active Partnerships</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {activePromos.map((promo) => {
                  const partner = promo.initiator_vendor_id === vendorId 
                    ? promo.partner_vendor 
                    : promo.initiator_vendor;
                  
                  return (
                    <Card key={promo.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={partner?.logo_url || undefined} />
                            <AvatarFallback>{partner?.business_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{partner?.business_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {promo.promo_type.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <Badge className="bg-green-500">Active</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Partner Suggestions */}
          {availablePartners.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Suggested Partners</h4>
              <div className="grid gap-4 md:grid-cols-3">
                {availablePartners.slice(0, 6).map((partner) => (
                  <Card key={partner.id} className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={partner.logo_url || undefined} />
                          <AvatarFallback>{partner.business_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{partner.business_name}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {crossPromos.length === 0 && availablePartners.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No cross-promotions yet.</p>
                <p className="text-sm text-muted-foreground">
                  Partner with other brands to reach new customers.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Bundle Dialog */}
      <Dialog open={showBundleDialog} onOpenChange={setShowBundleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Bundle Name</Label>
              <Input 
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="e.g., Weekend BBQ Pack"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={bundleDescription}
                onChange={(e) => setBundleDescription(e.target.value)}
                placeholder="Describe what's included in this bundle..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateBundle} disabled={isCreating || !bundleName}>
              {isCreating ? 'Creating...' : 'Create Bundle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Cross-Promo Dialog */}
      <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Partnership Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Select a partner brand and propose a cross-promotion collaboration.
            </p>
            {availablePartners.length > 0 ? (
              <div className="space-y-2">
                {availablePartners.slice(0, 5).map((partner) => (
                  <div 
                    key={partner.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted"
                    onClick={async () => {
                      await onCreateCrossPromo(partner.id, 'cross_display', {}, []);
                      setShowPromoDialog(false);
                    }}
                  >
                    <Avatar>
                      <AvatarImage src={partner.logo_url || undefined} />
                      <AvatarFallback>{partner.business_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">{partner.business_name}</span>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No available partners at the moment.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
