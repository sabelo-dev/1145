import { driverRpc } from "./nearbyDispatch";
export type DriverServiceKind = "passengers" | "food" | "parcels";
export interface DriverServices {
  passengers: boolean; food: boolean; parcels: boolean;
  passenger_eligible: boolean; vehicle_mode: string | null;
}
export const DRIVER_SERVICE_LABELS: Record<DriverServiceKind, string> = {
  passengers: "Passenger trips", food: "Food deliveries", parcels: "Parcels and goods",
};
export const fetchDriverServices = () => driverRpc<DriverServices | null>("driver_my_services");
export const saveDriverServices = (services: Pick<DriverServices, DriverServiceKind>) =>
  driverRpc<DriverServices>("driver_set_services", { p_passengers: services.passengers, p_food: services.food, p_parcels: services.parcels });
