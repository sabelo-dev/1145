import React from "react";
import { MapPin } from "lucide-react";
import PlacesAutocomplete from "@/components/maps/PlacesAutocomplete";

export interface AddressValue {
  text: string;
  coords: { lat: number; lng: number } | null;
}

/** Google Places search; coordinates are kept only when a suggestion is picked. */
const AddressField: React.FC<{
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <div>
    <PlacesAutocomplete
      value={value.text}
      onChange={(text) => onChange({ text, coords: null })}
      onPlaceSelect={(p) => onChange({ text: p.address, coords: { lat: p.lat, lng: p.lng } })}
      placeholder={placeholder}
      icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
    />
  </div>
);

export default AddressField;
