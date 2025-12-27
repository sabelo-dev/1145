import { matchingEngine } from "./matchingEngine";

// Pricing Configuration
export interface PricingConfig {
  baseFee: number;           // Base delivery fee
  perKmRate: number;         // Per kilometer rate
  minFee: number;            // Minimum delivery fee
  maxFee: number;            // Maximum cap on delivery fee
  urgentMultiplier: number;  // Multiplier for urgent deliveries
  nightMultiplier: number;   // Multiplier for night deliveries (8pm-6am)
  weekendMultiplier: number; // Multiplier for weekends
}

export interface PriceBreakdown {
  baseFee: number;
  distanceFee: number;
  timeFee: number;
  surgeFee: number;
  subtotal: number;
  platformFee: number;
  driverEarnings: number;
  totalPrice: number;
  surgeMultiplier: number;
  isUrgent: boolean;
  isNightDelivery: boolean;
  isWeekend: boolean;
}

// Default pricing configuration (ZAR)
const defaultConfig: PricingConfig = {
  baseFee: 25,
  perKmRate: 8,
  minFee: 35,
  maxFee: 250,
  urgentMultiplier: 1.5,
  nightMultiplier: 1.25,
  weekendMultiplier: 1.15,
};

// Pricing Engine
export const pricingEngine = {
  config: { ...defaultConfig },

  // Update pricing configuration
  updateConfig(newConfig: Partial<PricingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  },

  // Calculate delivery price with full breakdown
  async calculatePrice(
    distanceKm: number,
    options: {
      isUrgent?: boolean;
      scheduledTime?: Date;
    } = {}
  ): Promise<PriceBreakdown> {
    const { isUrgent = false, scheduledTime = new Date() } = options;
    const config = this.config;

    // Get current surge multiplier
    const surgeMultiplier = await matchingEngine.calculateSurgeMultiplier();

    // Check time-based factors
    const hour = scheduledTime.getHours();
    const day = scheduledTime.getDay();
    const isNightDelivery = hour >= 20 || hour < 6;
    const isWeekend = day === 0 || day === 6;

    // Calculate base components
    const baseFee = config.baseFee;
    const distanceFee = distanceKm * config.perKmRate;

    // Time-based multiplier
    let timeMultiplier = 1;
    if (isNightDelivery) timeMultiplier *= config.nightMultiplier;
    if (isWeekend) timeMultiplier *= config.weekendMultiplier;
    if (isUrgent) timeMultiplier *= config.urgentMultiplier;

    const timeFee = (baseFee + distanceFee) * (timeMultiplier - 1);

    // Surge pricing
    const subtotalBeforeSurge = baseFee + distanceFee + timeFee;
    const surgeFee = subtotalBeforeSurge * (surgeMultiplier - 1);

    // Calculate totals
    let subtotal = subtotalBeforeSurge + surgeFee;
    
    // Apply min/max caps
    subtotal = Math.max(config.minFee, Math.min(config.maxFee, subtotal));

    // Platform takes 15%, driver gets 85%
    const platformFee = subtotal * 0.15;
    const driverEarnings = subtotal * 0.85;

    return {
      baseFee,
      distanceFee: Math.round(distanceFee * 100) / 100,
      timeFee: Math.round(timeFee * 100) / 100,
      surgeFee: Math.round(surgeFee * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      driverEarnings: Math.round(driverEarnings * 100) / 100,
      totalPrice: Math.round(subtotal * 100) / 100,
      surgeMultiplier,
      isUrgent,
      isNightDelivery,
      isWeekend,
    };
  },

  // Quick estimate without surge calculation
  estimatePrice(distanceKm: number, isUrgent: boolean = false): number {
    const base = this.config.baseFee + (distanceKm * this.config.perKmRate);
    const estimate = isUrgent ? base * this.config.urgentMultiplier : base;
    return Math.max(this.config.minFee, Math.min(this.config.maxFee, Math.round(estimate * 100) / 100));
  },

  // Get surge status info
  async getSurgeInfo(): Promise<{ multiplier: number; status: string; color: string }> {
    const multiplier = await matchingEngine.calculateSurgeMultiplier();
    
    if (multiplier >= 2.0) {
      return { multiplier, status: "Very High Demand", color: "red" };
    }
    if (multiplier >= 1.5) {
      return { multiplier, status: "High Demand", color: "orange" };
    }
    if (multiplier >= 1.25) {
      return { multiplier, status: "Busy", color: "yellow" };
    }
    return { multiplier, status: "Normal", color: "green" };
  },
};
