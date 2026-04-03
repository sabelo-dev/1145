import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { passengerSecurityService } from "@/services/passengerSecurityService";
import { useToast } from "@/hooks/use-toast";

interface TripPinVerificationProps {
  rideId: string;
  role: 'passenger' | 'driver';
  onVerified?: () => void;
}

const TripPinVerification: React.FC<TripPinVerificationProps> = ({
  rideId,
  role,
  onVerified,
}) => {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPinState();
  }, [rideId]);

  const loadPinState = async () => {
    setLoading(true);
    const pinData = await passengerSecurityService.getTripPin(rideId);
    if (pinData) {
      setVerified(pinData.verified);
      setAttempts(pinData.attempts);
      if (role === 'passenger') {
        setGeneratedPin(pinData.pin_code);
      }
    } else if (role === 'passenger') {
      // Auto-generate PIN for passenger
      const newPin = await passengerSecurityService.generateTripPin(rideId);
      setGeneratedPin(newPin);
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (pin.length !== 4) return;
    setVerifying(true);
    const success = await passengerSecurityService.verifyTripPin(rideId, pin);
    setVerifying(false);

    if (success) {
      setVerified(true);
      toast({ title: "✅ PIN Verified", description: "Trip can now begin" });
      onVerified?.();
    } else {
      setAttempts((prev) => prev + 1);
      setPin("");
      toast({
        title: "❌ Invalid PIN",
        description: attempts >= 2 ? "Maximum attempts reached" : "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleRegenerate = async () => {
    const newPin = await passengerSecurityService.generateTripPin(rideId);
    setGeneratedPin(newPin);
    setAttempts(0);
    setVerified(false);
    toast({ title: "New PIN generated" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Loading PIN verification...
        </CardContent>
      </Card>
    );
  }

  if (verified) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">PIN Verified</p>
            <p className="text-sm text-green-600 dark:text-green-400">Trip identity confirmed — safe to start</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Passenger view: show the PIN to share
  if (role === 'passenger') {
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Your Trip PIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this PIN with your driver to verify identity before starting the trip.
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-4xl font-mono font-bold tracking-[0.5em] text-primary">
              {generatedPin || '----'}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" /> Secure verification
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="h-3 w-3 mr-1" /> New PIN
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Driver view: enter the PIN
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Verify Passenger PIN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ask the passenger for their 4-digit PIN and enter it below to start the trip.
        </p>
        <div className="flex justify-center">
          <InputOTP value={pin} onChange={setPin} maxLength={4}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        {attempts > 0 && (
          <p className="text-xs text-center text-destructive">
            {3 - attempts} attempts remaining
          </p>
        )}
        <Button
          onClick={handleVerify}
          disabled={pin.length !== 4 || verifying || attempts >= 3}
          className="w-full"
        >
          {verifying ? 'Verifying...' : 'Verify PIN'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TripPinVerification;
