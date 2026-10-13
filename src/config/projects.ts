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
  /** Capacity factor applied to corridor segments during construction. */
  constructionCapacityFactor: number;
  /** Permanent capacity factor on the corridor after completion. */
  completedCapacityFactor: number;
  /** Long-run reduction of car demand on the corridor itself (0..1). */
  corridorDemandReduction: number;
  /** Long-run reduction of car demand on the corridor's nearby alternatives. */
  catchmentDemandReduction: number;
  /** Days for mode shift to fully ramp up after completion. */
  rampUpDays: number;
}

export const PROJECT_CONFIG = {
  bikeLane: {
    baseCost: 400_000,
    costPerKm: 450_000,
    planningDays: 30,
    constructionBaseDays: 45,
    constructionDaysPerKm: 12,
    minConstructionDays: 60,
    maxCorridorKm: 15,
    minCorridorKm: 0.3,
    constructionCapacityFactor: 0.62,
    completedCapacityFactor: 0.94,
    corridorDemandReduction: 0.14,
    catchmentDemandReduction: 0.03,
    rampUpDays: 365,
  },
} as const satisfies Record<string, ProjectTypeConfig>;

export type ProjectTypeId = keyof typeof PROJECT_CONFIG;
