import React, { useState } from "react";
import { Search, MapPin, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StaysSearchBarProps {
  onSearch: (filters: {
    location: string;
    checkIn: Date | undefined;
    checkOut: Date | undefined;
    guests: number;
  }) => void;
}

const StaysSearchBar: React.FC<StaysSearchBarProps> = ({ onSearch }) => {
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(1);

  const handleSearch = () => {
    onSearch({ location, checkIn, checkOut, guests });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-3 md:p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
        {/* Location */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Where</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search destinations"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Check-in */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-in</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full md:w-[140px] justify-start text-left font-normal", !checkIn && "text-muted-foreground")}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {checkIn ? format(checkIn, "MMM dd") : "Add date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} disabled={(d) => d < new Date()} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Check-out */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-out</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full md:w-[140px] justify-start text-left font-normal", !checkOut && "text-muted-foreground")}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {checkOut ? format(checkOut, "MMM dd") : "Add date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} disabled={(d) => d < (checkIn || new Date())} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Guests</label>
          <div className="flex items-center border rounded-md px-3 h-10 gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="bg-transparent text-sm outline-none flex-1"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search button */}
        <Button onClick={handleSearch} className="h-10 px-6">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>
    </div>
  );
};

export default StaysSearchBar;
