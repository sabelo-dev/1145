import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BookingForm from "@/components/stays/BookingForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MapPin, Users, BedDouble, Bath, Wifi, Car, Waves, Coffee, Utensils, Wind, Tv, Shield } from "lucide-react";
import type { LodgingProperty } from "@/components/stays/PropertyCard";

const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi, parking: Car, pool: Waves, breakfast: Coffee, restaurant: Utensils, "air conditioning": Wind, tv: Tv, security: Shield,
};

const StayDetailPage: React.FC = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const { data: property, isLoading } = useQuery({
    queryKey: ["lodging-property", propertyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lodging_properties").select("*").eq("id", propertyId).single();
      if (error) throw error;
      return data as LodgingProperty & { check_in_time: string; check_out_time: string; address: string; description: string };
    },
    enabled: !!propertyId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["lodging-reviews", propertyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lodging_reviews").select("*, profiles:user_id(name, email)").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!propertyId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-[400px] rounded-xl mb-6" />
        <Skeleton className="h-8 w-1/2 mb-3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Property not found</h2>
        <Button onClick={() => navigate("/stays")}>Back to Stays</Button>
      </div>
    );
  }

  const images = property.images?.length ? property.images : ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/stays")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to stays
        </Button>

        {/* Image gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-2xl overflow-hidden mb-6 max-h-[400px]">
          <img src={images[0]} alt={property.name} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {images.slice(1, 5).map((img: string, i: number) => (
                <img key={i} src={img} alt="" className="w-full h-full object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Details */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <Badge variant="secondary" className="mb-2 capitalize">{property.type}</Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{property.name}</h1>
              </div>
              {property.rating > 0 && (
                <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{property.rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({property.review_count})</span>
                </div>
              )}
            </div>

            {(property.city || property.address) && (
              <div className="flex items-center gap-1 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{[property.address, property.city].filter(Boolean).join(", ")}</span>
              </div>
            )}

            <div className="flex gap-4 text-sm text-muted-foreground mb-6 border-b pb-4">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />{property.max_guests} guests</span>
              <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{property.bedrooms} bedroom{property.bedrooms > 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{property.bathrooms} bathroom{property.bathrooms > 1 ? "s" : ""}</span>
            </div>

            {property.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">About this place</h2>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{property.description}</p>
              </div>
            )}

            {/* Amenities */}
            {property.amenities?.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Amenities</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {property.amenities.map((a: string) => {
                    const Icon = amenityIcons[a.toLowerCase()] || Shield;
                    return (
                      <div key={a} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Check-in info */}
            <div className="mb-6 bg-muted/50 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-2">House rules</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Check-in:</span> <span className="font-medium">{property.check_in_time || "14:00"}</span></div>
                <div><span className="text-muted-foreground">Check-out:</span> <span className="font-medium">{property.check_out_time || "11:00"}</span></div>
                <div><span className="text-muted-foreground">Cancellation:</span> <span className="font-medium capitalize">{property.cancellation_policy}</span></div>
              </div>
            </div>

            {/* Reviews */}
            {reviews && reviews.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Reviews</h2>
                <div className="space-y-4">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="border-b pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{r.profiles?.name || "Guest"}</span>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking form */}
          <BookingForm propertyId={property.id} pricePerNight={property.price_per_night} maxGuests={property.max_guests} />
        </div>
      </div>
    </div>
  );
};

export default StayDetailPage;
