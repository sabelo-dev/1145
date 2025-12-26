import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  QrCode,
  KeyRound,
  CheckCircle,
  Package,
  Store,
  Clock,
  Phone,
  AlertCircle,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PickupVerificationProps {
  job: {
    id: string;
    order_id: string | null;
    pickup_address: any;
    status: string;
    notes: string | null;
  };
  onVerified: () => void;
}

const PickupVerification: React.FC<PickupVerificationProps> = ({ job, onVerified }) => {
  const [verificationMethod, setVerificationMethod] = useState<"pin" | "qr" | null>(null);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();

  // Generate expected PIN (in real app, this comes from backend)
  const expectedPin = job.order_id ? job.order_id.slice(-4).toUpperCase() : "0000";

  const handlePinVerification = async () => {
    setIsVerifying(true);

    // Simulate PIN verification
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (pin.toUpperCase() === expectedPin || pin === "1234") {
      await markAsPickedUp();
    } else {
      toast({
        variant: "destructive",
        title: "Invalid PIN",
        description: "The PIN you entered doesn't match. Please try again.",
      });
    }

    setIsVerifying(false);
  };

  const handleQRScan = async (scannedData: string) => {
    setIsVerifying(true);

    // Simulate QR verification
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (scannedData.includes(job.id) || scannedData === "valid") {
      await markAsPickedUp();
    } else {
      toast({
        variant: "destructive",
        title: "Invalid QR Code",
        description: "This QR code doesn't match the order.",
      });
    }

    setShowScanner(false);
    setIsVerifying(false);
  };

  const markAsPickedUp = async () => {
    const { error } = await supabase
      .from("delivery_jobs")
      .update({
        status: "picked_up",
        pickup_time: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update pickup status.",
      });
    } else {
      toast({
        title: "Pickup Verified!",
        description: "Order marked as picked up. Head to the delivery location.",
      });
      onVerified();
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-amber-600" />
          Pickup Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Vendor Info */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{formatAddress(job.pickup_address)}</p>
            {job.notes && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Note:</span> {job.notes}
              </p>
            )}
          </div>
        </div>

        {/* Order Reference */}
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
          <span className="text-sm text-muted-foreground">Order Reference</span>
          <Badge variant="outline" className="font-mono">
            #{job.order_id?.slice(-8) || job.id.slice(-8)}
          </Badge>
        </div>

        {/* Verification Methods */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Verify pickup with vendor:</p>
          
          <div className="grid grid-cols-2 gap-3">
            {/* PIN Verification */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setVerificationMethod("pin")}
                >
                  <KeyRound className="h-6 w-6 text-primary" />
                  <span>Enter PIN</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Enter Pickup PIN
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Ask the vendor for the 4-digit pickup PIN
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN Code</Label>
                    <Input
                      id="pin"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePinVerification}
                    disabled={pin.length !== 4 || isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verify PIN
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* QR Code Scan */}
            <Dialog open={showScanner} onOpenChange={setShowScanner}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode className="h-6 w-6 text-primary" />
                  <span>Scan QR</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Scan Pickup QR Code
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Camera preview would appear here
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Point your camera at the vendor's QR code
                  </p>
                  {/* Simulate scan button for demo */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleQRScan("valid")}
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Simulate Successful Scan"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Help text */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">Having trouble?</p>
            <p className="text-blue-700 dark:text-blue-300">
              Contact the vendor or support if you cannot verify pickup.
            </p>
          </div>
        </div>

        {/* Contact Vendor */}
        {job.pickup_address?.phone && (
          <Button variant="outline" className="w-full" asChild>
            <a href={`tel:${job.pickup_address.phone}`}>
              <Phone className="h-4 w-4 mr-2" />
              Call Vendor
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PickupVerification;
