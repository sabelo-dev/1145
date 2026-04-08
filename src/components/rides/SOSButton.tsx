import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Phone } from "lucide-react";
import { passengerSecurityService } from "@/services/passengerSecurityService";
import { trackingService } from "@/services/trackingService";
import { useToast } from "@/hooks/use-toast";

interface SOSButtonProps {
  rideId: string;
  passengerId: string;
  driverId?: string;
  className?: string;
}

const SOSButton: React.FC<SOSButtonProps> = ({ rideId, passengerId, driverId, className }) => {
  const { toast } = useToast();
  const [triggering, setTriggering] = useState(false);

  const handleSOS = useCallback(async () => {
    setTriggering(true);

    // Get current location
    const position = await trackingService.getCurrentPosition();
    const location = position ? { lat: position.lat, lng: position.lng } : undefined;

    const alertId = await passengerSecurityService.triggerSOS(rideId, passengerId, location, driverId);
    setTriggering(false);

    if (alertId) {
      toast({
        title: "🆘 Emergency Alert Sent",
        description: "Your emergency contacts and our safety team have been notified. Stay safe.",
      });
    } else {
      toast({
        title: "Alert Failed",
        description: "Please call emergency services directly at 10111",
        variant: "destructive",
      });
    }
  }, [rideId, passengerId, driverId]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="lg"
          className={`font-bold ${className}`}
        >
          <Phone className="h-5 w-5 mr-2" />
          SOS
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="pointer-events-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            🆘 Emergency SOS
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This will immediately:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Alert our safety control center</li>
              <li>Notify your emergency contacts</li>
              <li>Share your live location with responders</li>
              <li>Record the incident for investigation</li>
            </ul>
            <p className="font-medium text-foreground pt-2">
              For life-threatening emergencies, also call <strong>10111</strong> (SAPS).
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSOS}
            disabled={triggering}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {triggering ? "Sending Alert..." : "Confirm SOS"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SOSButton;
