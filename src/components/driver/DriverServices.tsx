import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DRIVER_SERVICE_LABELS, fetchDriverServices, saveDriverServices, type DriverServiceKind } from "@/services/driverServices";

export default function DriverServices() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const queryKey = ["driver-services", user?.id];
  const services = useQuery({ queryKey, queryFn: fetchDriverServices, enabled: !!user });
  const [draft, setDraft] = useState({ passengers: false, food: false, parcels: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (services.data) setDraft({ passengers: services.data.passengers, food: services.data.food, parcels: services.data.parcels });
  }, [services.data]);
  return <Card>
    <CardHeader><CardTitle>Services I accept</CardTitle><CardDescription>Choose passenger trips, food deliveries, parcels and goods, or any allowed combination.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {services.isLoading ? <p>Loading your services...</p> : services.isError ? <p role="alert" className="text-destructive">Could not load your services. <Button variant="outline" onClick={() => void services.refetch()}>Retry</Button></p> : !services.data ? <p>A driver account is required.</p> : <>
        <p className="text-sm text-muted-foreground">{services.data.vehicle_mode ? `Verified vehicle: ${services.data.vehicle_mode}.` : "Your vehicle type has not been verified."} Scooters are for food and parcel deliveries only. Passenger trips require a verified car or passenger van.</p>
        {(Object.keys(DRIVER_SERVICE_LABELS) as DriverServiceKind[]).map(kind => <div key={kind} className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <Label htmlFor={`driver-service-${kind}`}>{DRIVER_SERVICE_LABELS[kind]}{kind === "passengers" && !services.data.passenger_eligible && <span className="block text-xs font-normal text-muted-foreground">Unavailable for this vehicle</span>}</Label>
          <Switch id={`driver-service-${kind}`} checked={draft[kind]} disabled={saving || (kind === "passengers" && !services.data.passenger_eligible)} onCheckedChange={checked => { setDraft(current => ({ ...current, [kind]: checked })); setMessage(""); }} />
        </div>)}
        {!draft.passengers && !draft.food && !draft.parcels && <p className="text-sm text-muted-foreground">All services are off. You will receive no new offers.</p>}
        <p className="text-xs text-muted-foreground">Changes apply to new and outstanding offers. Finish any trip or delivery you have already accepted.</p>
        <Button disabled={saving} onClick={async () => {
          setSaving(true); setMessage(""); setError("");
          try {
            const saved = await saveDriverServices(draft);
            cache.setQueryData(queryKey, saved);
            await cache.invalidateQueries({ queryKey: ["nearby-driver-offers"] });
            setMessage("Your services have been saved.");
          } catch (e) { setError(e instanceof Error ? e.message : "Could not save your services"); }
          finally { setSaving(false); }
        }}>{saving ? "Saving..." : "Save services"}</Button>
      </>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
