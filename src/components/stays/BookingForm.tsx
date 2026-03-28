import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Users, Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface BookingFormProps {
  propertyId: string;
  pricePerNight: number;
  maxGuests: number;
}

const BookingForm: React.FC<BookingFormProps> = ({ propertyId, pricePerNight, maxGuests }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [loading, setLoading] = useState(false);

  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const subtotal = nights * pricePerNight;
  const serviceFee = Math.round(subtotal * 0.1);
  const total = subtotal + serviceFee;

  const handleBook = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!checkIn || !checkOut || nights < 1) {
      toast({ title: "Please select valid dates", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("lodging_bookings").insert({
      property_id: propertyId,
      user_id: user.id,
      check_in: format(checkIn, "yyyy-MM-dd"),
      check_out: format(checkOut, "yyyy-MM-dd"),
      guests,
      total_price: total,
      special_requests: specialRequests || null,
    } as any);

    setLoading(false);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking submitted!", description: "Your reservation is pending confirmation." });
      navigate("/dashboard?tab=stays");
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-card shadow-sm sticky top-24">
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold">R{pricePerNight.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">/ night</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Check-in</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !checkIn && "text-muted-foreground")}>
                <CalendarDays className="mr-1 h-3 w-3" />
                {checkIn ? format(checkIn, "MMM dd") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} disabled={(d) => d < new Date()} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Check-out</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !checkOut && "text-muted-foreground")}>
                <CalendarDays className="mr-1 h-3 w-3" />
                {checkOut ? format(checkOut, "MMM dd") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} disabled={(d) => d < (checkIn || new Date())} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs font-medium text-muted-foreground">Guests</label>
        <div className="flex items-center border rounded-md px-3 h-9 gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="bg-transparent text-sm outline-none flex-1">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
            ))}
          </select>
        </div>
      </div>

      <Textarea
        placeholder="Special requests (optional)"
        value={specialRequests}
        onChange={(e) => setSpecialRequests(e.target.value)}
        className="mb-4 text-sm"
        rows={2}
      />

      {nights > 0 && (
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">R{pricePerNight.toLocaleString()} × {nights} night{nights > 1 ? "s" : ""}</span>
            <span>R{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service fee</span>
            <span>R{serviceFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total</span>
            <span>R{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      <Button onClick={handleBook} disabled={loading || nights < 1} className="w-full" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {nights > 0 ? `Reserve · R${total.toLocaleString()}` : "Select dates to book"}
      </Button>
    </div>
  );
};

export default BookingForm;
