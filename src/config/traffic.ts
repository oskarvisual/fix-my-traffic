/**
 * Traffic model coefficients. These are game-balance values, NOT measured
 * engineering constants. Tweak here; never inline them in components.
 */
export const ROAD_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'] as const;
export type RoadType = (typeof ROAD_TYPES)[number];

export const TRAFFIC_CONFIG = {
  /** Peak-hour vehicles/hour that one lane can carry, by road class. */
  laneCapacityVph: {
    motorway: 1900,
    trunk: 1700,
    primary: 1100,
    secondary: 900,
    tertiary: 750,
  } satisfies Record<RoadType, number>,

  /** Congestion score = clamp((v/c - vcFree) / (vcJam - vcFree), 0, 1). */
  vcFree: 0.4,
  vcJam: 1.4,

  /** BPR travel-time function: t = t0 * (1 + alpha * (v/c)^beta). */
  bprAlpha: 0.15,
  bprBeta: 4,

  /** Share of capacity-loss that makes drivers divert (0..1 per unit of lost capacity). */
  diversionElasticity: 0.7,
  /** Maximum share of a segment's own demand that can divert. */
  maxDiversionShare: 0.45,
  /** Share of diverted trips that are suppressed (time shift, mode shift, cancelled). */
  suppressedShareOfDiverted: 0.2,
  /** Minimum relative spare capacity used when weighting alternatives. */
  minSpareWeight: 0.05,

  /** Annual background growth of car demand if nothing is done. */
  annualDemandGrowth: 0.018,
} as const;

/** Congestion buckets for visualisation. Upper bounds are exclusive except the last. */
export const CONGESTION_LEVELS = [
  { id: 'free', max: 0.35, color: '#22c55e' },
  { id: 'moderate', max: 0.55, color: '#eab308' },
  { id: 'heavy', max: 0.75, color: '#f97316' },
  { id: 'severe', max: 0.9, color: '#ef4444' },
  { id: 'extreme', max: 1.0001, color: '#7f1d1d' },
] as const;
export type CongestionLevelId = (typeof CONGESTION_LEVELS)[number]['id'];
