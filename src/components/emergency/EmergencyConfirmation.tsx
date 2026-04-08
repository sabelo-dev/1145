import React from "react";
import { Button } from "@/components/ui/button";
import { Phone, Shield, MapPin, Users } from "lucide-react";

interface EmergencyConfirmationProps {
  eventId: string;
  onDismiss: () => void;
}

const EmergencyConfirmation: React.FC<EmergencyConfirmationProps> = ({
  eventId,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-8">
        {/* Pulsing indicator */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-destructive flex items-center justify-center">
            <Shield className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Help is on the way</h1>
          <p className="text-white/70">
            Your emergency contacts and our safety team have been notified.
          </p>
        </div>

        {/* Status indicators */}
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
            <MapPin className="h-5 w-5 text-green-400 shrink-0" />
            <span className="text-white text-sm">Live location sharing active</span>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
            <Users className="h-5 w-5 text-blue-400 shrink-0" />
            <span className="text-white text-sm">Emergency contacts notified</span>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
            <Shield className="h-5 w-5 text-orange-400 shrink-0" />
            <span className="text-white text-sm">Safety team monitoring</span>
          </div>
        </div>

        {/* Emergency call */}
        <a
          href="tel:10111"
          className="flex items-center justify-center gap-2 bg-white text-black rounded-full py-4 px-6 font-bold text-lg w-full hover:bg-white/90 transition-colors"
        >
          <Phone className="h-5 w-5" />
          Call SAPS — 10111
        </a>

        <p className="text-white/40 text-xs">
          Event ID: {eventId.slice(0, 8)}
        </p>

        <Button
          variant="ghost"
          onClick={onDismiss}
          className="text-white/50 hover:text-white"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

export default EmergencyConfirmation;
