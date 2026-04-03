import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, ShoppingCart, Clock } from "lucide-react";
import { zoneComplianceService } from "@/services/zoneComplianceService";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ZoneComplianceIndicatorProps {
  driverId: string;
  currentLat: number | null;
  currentLng: number | null;
}

const ZoneComplianceIndicator: React.FC<ZoneComplianceIndicatorProps> = ({
  driverId,
  currentLat,
  currentLng,
}) => {
  const { toast } = useToast();
  const [zoneStatus, setZoneStatus] = useState<{
    status: 'GREEN' | 'YELLOW' | 'RED';
    zone: string | null;
    message: string;
    canOperate: boolean;
  } | null>(null);
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (currentLat && currentLng && driverId) {
      checkZone();
    }
  }, [currentLat, currentLng, driverId]);

  const checkZone = async () => {
    if (!currentLat || !currentLng) return;
    const status = await zoneComplianceService.getDriverZoneStatus(driverId, currentLat, currentLng);
    setZoneStatus(status);
  };

  const openPassPurchase = async () => {
    const zonesData = await zoneComplianceService.getActiveZones();
    setZones(zonesData);
    setShowPassDialog(true);
  };

  const handlePurchasePass = async (zoneId: string, passType: 'HOURLY' | 'DAILY' | 'WEEKLY') => {
    setPurchasing(true);
    const result = await zoneComplianceService.purchaseZonePass(driverId, zoneId, passType);
    setPurchasing(false);

    if (result.success) {
      toast({ title: "Zone Pass Purchased", description: `${passType} pass activated successfully` });
      setShowPassDialog(false);
      checkZone();
    } else {
      toast({ title: "Purchase Failed", description: result.error, variant: "destructive" });
    }
  };

  if (!zoneStatus) return null;

  const statusColors = {
    GREEN: 'bg-green-500',
    YELLOW: 'bg-amber-500',
    RED: 'bg-red-500',
  };

  const statusBg = {
    GREEN: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    YELLOW: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    RED: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const pricing = zoneComplianceService.getPassPricing();

  return (
    <>
      <Card className={`border ${statusBg[zoneStatus.status]}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusColors[zoneStatus.status]} ${zoneStatus.status === 'RED' ? 'animate-pulse' : ''}`} />
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium text-sm">Zone: {zoneStatus.zone || 'Unknown'}</span>
                </div>
                <p className="text-xs text-muted-foreground">{zoneStatus.message}</p>
              </div>
            </div>
            {zoneStatus.status === 'RED' && (
              <Button size="sm" variant="outline" onClick={openPassPurchase}>
                <ShoppingCart className="h-3 w-3 mr-1" /> Buy Pass
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPassDialog} onOpenChange={setShowPassDialog}>
        <DialogContent className="pointer-events-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Zone Access Pass
            </DialogTitle>
            <DialogDescription>
              Purchase a temporary pass to operate in this zone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardContent className="py-3">
                  <p className="font-medium mb-3">{zone.name} ({zone.code})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['HOURLY', 'DAILY', 'WEEKLY'] as const).map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        disabled={purchasing}
                        onClick={() => handlePurchasePass(zone.id, type)}
                        className="flex flex-col h-auto py-2"
                      >
                        <Clock className="h-3 w-3 mb-1" />
                        <span className="text-xs">{type}</span>
                        <span className="text-xs font-bold">R{pricing[type]}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZoneComplianceIndicator;
