import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ShipmentTrackingCard from "../components/ShipmentTrackingCard";

const TrackPage: React.FC = () => {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(trackingNumber ?? "");


  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">LX</div>
          <span className="font-semibold">1145 Logistics</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Track a parcel</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the tracking number from your SMS or receipt.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) navigate(`/track/${encodeURIComponent(input.trim().toUpperCase())}`);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. LX261116A1B2C3" className="pl-9 h-11 uppercase" />
          </div>
          <Button type="submit" className="h-11">
            Track
          </Button>
        </form>

        {trackingNumber && <ShipmentTrackingCard trackingNumber={trackingNumber} />}
      </main>
    </div>
  );
};

export default TrackPage;
