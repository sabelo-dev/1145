import { requestNearbyDispatch } from "./nearbyDispatch";
export const rideMatchingService = {
  async matchRideToDrivers(rideId: string) {
    const result = await requestNearbyDispatch("ride", rideId);
    return { ...result, status: result.status === "no_drivers" ? "no_drivers" as const : "searching" as const };
  },
  async retryMatch(rideId: string, attempt = 1) {
    const result = await requestNearbyDispatch("ride", rideId);
    return { ...result, shouldRetry: !["no_drivers", "accepted", "closed"].includes(result.status) && attempt < 20 };
  },
};
