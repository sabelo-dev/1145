import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Users, BedDouble, Bath } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface LodgingProperty {
  id: string;
  name: string;
  description: string | null;
  type: string;
  location: string | null;
  city: string | null;
  province: string | null;
  images: string[];
  amenities: string[];
  rating: number;
  review_count: number;
  price_per_night: number;
  currency: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  cancellation_policy: string;
}

const typeLabels: Record<string, string> = {
  hotel: "Hotel",
  airbnb: "Airbnb",
  guesthouse: "Guesthouse",
  lodge: "Lodge",
  hostel: "Hostel",
};

const PropertyCard: React.FC<{ property: LodgingProperty }> = ({ property }) => {
  const navigate = useNavigate();
  const heroImage = property.images?.[0] || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600";

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      onClick={() => navigate(`/stays/${property.id}`)}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={heroImage}
          alt={property.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <Badge className="absolute top-3 left-3 bg-background/90 text-foreground backdrop-blur-sm text-xs">
          {typeLabels[property.type] || property.type}
        </Badge>
        {property.cancellation_policy === "flexible" && (
          <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white text-xs">
            Free cancellation
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-foreground line-clamp-1 text-sm md:text-base">{property.name}</h3>
          {property.rating > 0 && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-medium">{property.rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({property.review_count})</span>
            </div>
          )}
        </div>

        {(property.city || property.location) && (
          <div className="flex items-center gap-1 text-muted-foreground mb-2">
            <MapPin className="h-3 w-3" />
            <span className="text-xs line-clamp-1">{property.city || property.location}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{property.max_guests}</span>
          <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{property.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{property.bathrooms}</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-foreground">
            R{property.price_per_night.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">/ night</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PropertyCard;
