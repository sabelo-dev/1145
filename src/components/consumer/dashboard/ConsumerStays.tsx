import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CalendarDays, Users, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  checked_in: "bg-blue-100 text-blue-800",
  checked_out: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

const ConsumerStays: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["consumer-stays", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lodging_bookings")
        .select("*, lodging_properties:property_id(name, city, type, images, price_per_night)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const upcoming = bookings?.filter((b: any) => ["pending", "confirmed"].includes(b.status)) || [];
  const past = bookings?.filter((b: any) => ["checked_out", "cancelled"].includes(b.status)) || [];

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{bookings?.length || 0}</p><p className="text-xs text-muted-foreground">Total Stays</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{upcoming.length}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">R{bookings?.reduce((s: number, b: any) => s + (b.total_price || 0), 0).toLocaleString() || 0}</p><p className="text-xs text-muted-foreground">Total Spent</p></CardContent></Card>
      </div>

      {/* Upcoming */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Upcoming Stays</h3>
        {upcoming.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No upcoming stays</p>
            <p className="text-sm text-muted-foreground mb-3">Browse properties and book your next getaway.</p>
            <Button onClick={() => navigate("/stays")} size="sm">Browse Stays</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b: any) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Past Stays</h3>
          <div className="space-y-3">
            {past.map((b: any) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BookingCard: React.FC<{ booking: any }> = ({ booking }) => {
  const property = booking.lodging_properties;
  const img = property?.images?.[0] || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <img src={img} alt={property?.name} className="w-full sm:w-32 h-24 sm:h-auto object-cover" />
        <CardContent className="p-4 flex-1">
          <div className="flex items-start justify-between mb-1">
            <h4 className="font-semibold text-sm">{property?.name || "Property"}</h4>
            <Badge className={statusColors[booking.status] || ""}>{booking.status?.replace("_", " ")}</Badge>
          </div>
          {property?.city && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><MapPin className="h-3 w-3" />{property.city}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(booking.check_in), "MMM dd")} – {format(new Date(booking.check_out), "MMM dd")}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{booking.guests} guest{booking.guests > 1 ? "s" : ""}</span>
            <span className="font-medium text-foreground">R{booking.total_price?.toLocaleString()}</span>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default ConsumerStays;
