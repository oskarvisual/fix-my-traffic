/**
 * Project-type balance values (game estimates, not real procurement prices).
 * Money is expressed in US dollars for the whole game.
 */
export interface ProjectTypeConfig {
  /** Fixed mobilisation cost. */
  baseCost: number;
  costPerKm: number;
  planningDays: number;
  /** Construction days = max(minConstructionDays, base + perKm * km). */
  constructionBaseDays: number;
  constructionDaysPerKm: number;
  minConstructionDays: number;
  maxCorridorKm: number;
  minCorridorKm: number;
  /** Capacity factor applied to corridor segments during construction (e.g. 0.35 = -65% capacity). */
  constructionCapacityFactor: number;
  /** Permanent capacity factor on the corridor after completion. */
  completedCapacityFactor: number;
  /** Long-run reduction of car demand on the corridor itself (0..1). */
  corridorDemandReduction: number;
  /** Long-run reduction of car demand on the corridor's nearby alternatives. */
  catchmentDemandReduction: number;
  /** Days for mode shift to fully ramp up after completion. */
  rampUpDays: number;
  /** Icon representation. */
  icon: string;
}

export const PROJECT_CONFIG = {
  bikeLane: {
    icon: '🚲',
    baseCost: 400_000,
    costPerKm: 450_000,
    planningDays: 20,
    constructionBaseDays: 45,
    constructionDaysPerKm: 12,
    minConstructionDays: 45,
    maxCorridorKm: 15,
    minCorridorKm: 0.3,
    constructionCapacityFactor: 0.70, // 30% reduction during works
    completedCapacityFactor: 0.94,
    corridorDemandReduction: 0.14,
    catchmentDemandReduction: 0.03,
    rampUpDays: 180,
  },
  brt: {
    icon: '🚌',
    baseCost: 12_000_000,
    costPerKm: 7_500_000,
    planningDays: 60,
    constructionBaseDays: 90,
    constructionDaysPerKm: 20,
    minConstructionDays: 120,
    maxCorridorKm: 25,
    minCorridorKm: 1.0,
    constructionCapacityFactor: 0.35, // 65% capacity loss during works (heavy diversion!)
    completedCapacityFactor: 0.85, // Segregated bus lane takes 1 lane
    corridorDemandReduction: 0.30, // 30% car drivers switch to BRT
    catchmentDemandReduction: 0.08,
    rampUpDays: 180,
  },
  elevatedMetro: {
    icon: '🚊',
    baseCost: 65_000_000,
    costPerKm: 32_000_000,
    planningDays: 120,
    constructionBaseDays: 200,
    constructionDaysPerKm: 35,
    minConstructionDays: 300,
    maxCorridorKm: 35,
    minCorridorKm: 2.0,
    constructionCapacityFactor: 0.50, // Central median occupied by viaduct columns
    completedCapacityFactor: 0.95,
    corridorDemandReduction: 0.45, // Major mode shift
    catchmentDemandReduction: 0.14,
    rampUpDays: 240,
  },
  subway: {
    icon: '🚇',
    baseCost: 160_000_000,
    costPerKm: 65_000_000,
    planningDays: 180,
    constructionBaseDays: 365,
    constructionDaysPerKm: 50,
    minConstructionDays: 500,
    maxCorridorKm: 40,
    minCorridorKm: 2.5,
    constructionCapacityFactor: 0.80, // Tunneling underground, surface impact mainly around stations
    completedCapacityFactor: 1.00, // 0 surface lane loss
    corridorDemandReduction: 0.55, // Massive relief
    catchmentDemandReduction: 0.20,
    rampUpDays: 365,
  },
  roundabout: {
    icon: '🔄',
    baseCost: 2_500_000,
    costPerKm: 1_200_000,
    planningDays: 15,
    constructionBaseDays: 30,
    constructionDaysPerKm: 15,
    minConstructionDays: 40,
    maxCorridorKm: 3,
    minCorridorKm: 0.1,
    constructionCapacityFactor: 0.20, // Major blockage during roundabout construction
    completedCapacityFactor: 1.22, // Improves intersection throughput!
    corridorDemandReduction: 0.03,
    catchmentDemandReduction: 0.01,
    rampUpDays: 30,
  },
} as const satisfies Record<string, ProjectTypeConfig>;

export type ProjectTypeId = keyof typeof PROJECT_CONFIG;
