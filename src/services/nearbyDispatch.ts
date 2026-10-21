import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./driverVerificationService";

export interface NearbyOffer {
  id: string; service_kind: "passengers" | "food" | "parcels"; entity_type: "ride" | "delivery_job"; entity_id: string;
  pickup_address: string; dropoff_address: string; distance_km: number;
  expires_at: string; radius_km: number; amount: number | null;
}
export interface NearbyDispatchResult {
  status: string; driversFound: number; driversNotified: number; radiusKm?: number;
}
export async function driverRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  // Location callbacks may run after the app has spent an hour in the background.
  await supabase.auth.getSession();
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export const fetchNearbyOffers = () => driverRpc<NearbyOffer[]>("driver_nearby_offers");
export const respondToOffer = async (id: string, accept: boolean) => driverRpc<void>("driver_respond_offer", {
  p_assignment: id, p_accept: accept, p_device_id: await getDeviceId(),
});
export const requestNearbyDispatch = (kind: string, id: string) => driverRpc<NearbyDispatchResult>("request_nearby_dispatch", { p_kind: kind, p_id: id });
