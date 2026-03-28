import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StaysSearchBar from "@/components/stays/StaysSearchBar";
import PropertyCard, { LodgingProperty } from "@/components/stays/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StaysPage: React.FC = () => {
  const [filters, setFilters] = useState({ location: "", type: "" });

  const { data: properties, isLoading } = useQuery({
    queryKey: ["lodging-properties", filters],
    queryFn: async () => {
      let query = (supabase as any).from("lodging_properties").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (filters.location) {
        query = query.or(`city.ilike.%${filters.location}%,location.ilike.%${filters.location}%,name.ilike.%${filters.location}%`);
      }
      if (filters.type) {
        query = query.eq("type", filters.type);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LodgingProperty[];
    },
  });

  const handleSearch = (searchFilters: any) => {
    setFilters((prev) => ({ ...prev, location: searchFilters.location }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/90 via-primary to-purple-700 text-white">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight">Find your perfect stay</h1>
          <p className="text-white/70 text-base md:text-lg mb-8 max-w-lg">Hotels, guesthouses, lodges & more — book directly on 1145.</p>
          <StaysSearchBar onSearch={handleSearch} />
        </div>
      </div>

      {/* Filters & Results */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isLoading ? "Loading..." : `${properties?.length || 0} stays available`}
            </h2>
          </div>
          <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="hotel">Hotel</SelectItem>
              <SelectItem value="airbnb">Airbnb</SelectItem>
              <SelectItem value="guesthouse">Guesthouse</SelectItem>
              <SelectItem value="lodge">Lodge</SelectItem>
              <SelectItem value="hostel">Hostel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[320px] rounded-xl" />
            ))}
          </div>
        ) : properties && properties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No stays found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaysPage;
