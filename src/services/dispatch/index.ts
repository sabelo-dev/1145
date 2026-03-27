/**
 * High-Performance Logistics Dispatch Engine
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │              Dispatch Engine (Brain)             │
 * │  Orchestrates matching, assignment, recovery     │
 * ├──────────┬──────────┬──────────┬────────────────┤
 * │ Scoring  │ Supply   │ Surge    │ Failure        │
 * │ Engine   │ State    │ Engine   │ Recovery       │
 * │          │ Manager  │          │                │
 * ├──────────┴──────────┴──────────┴────────────────┤
 * │              Geo Utilities                       │
 * │  Haversine, bounding box, bearing               │
 * └─────────────────────────────────────────────────┘
 * 
 * Backed by:
 * - Supabase Realtime (sub-second driver updates)
 * - PostgreSQL functions (score_driver_for_dispatch, calculate_zone_surge)
 * - Event triggers (auto dispatch_events on ride/delivery changes)
 */

export { dispatchEngine } from "./dispatchEngine";
export type { DispatchRequest, DispatchResult, BatchCandidate } from "./dispatchEngine";

export { scoringEngine } from "./scoringEngine";
export type { DriverCandidate, ScoredDriver, ScoringWeights } from "./scoringEngine";

export { supplyState } from "./supplyStateManager";
export type { SupplySnapshot } from "./supplyStateManager";

export { surgeEngine } from "./surgeEngine";
export type { SurgeResult, ZoneDemand, PricingFactors } from "./surgeEngine";

export { failureRecovery } from "./failureRecovery";
export type { RecoveryResult } from "./failureRecovery";

export {
  haversineDistance,
  estimateTravelMins,
  bearing,
  boundingBox,
  isWithinRadius,
  sortByDistance,
} from "./geoUtils";
export type { GeoPoint } from "./geoUtils";
