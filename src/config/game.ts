/** Time, economy and politics balance values. */
export const TIME_CONFIG = {
  /** Target pacing: 1 simulated year per 24 real hours of active play at 1x. */
  realSecondsPerSimDayAt1x: (24 * 60 * 60) / 365,
  speeds: [0, 1, 2, 4, 8] as const,
  /** Debug-only speed multiplier (enabled with ?debug=1 or in dev builds). */
  debugTurboSpeed: 2400,
  /** Safety cap so a long frame never simulates huge chunks at once. */
  maxSimDaysPerFrame: 5,
  startDate: '2027-01-01',
  termYears: 5,
} as const;

export type SpeedSetting = number;

export const ECONOMY_CONFIG = {
  /** Game estimate, not an official budget figure. */
  annualTransportBudget: 600_000_000,
  initialPublicBudget: 600_000_000,
  ministerMonthlySalary: 4_500,
  initialPersonalBalance: 25_000,
} as const;

export const POLITICS_CONFIG = {
  initialApproval: 0.48,
  /** Approval moves this fraction toward its target each month. */
  monthlyApprovalInertia: 0.25,
  /** Approval change per 0.01 of network congestion improvement vs. start. */
  approvalPerCongestionPoint: 0.012,
  constructionDisruptionPenalty: 0.03,
  completedProjectBonus: 0.015,
  maxCompletedProjectBonus: 0.12,
  minApproval: 0.02,
  maxApproval: 0.95,
} as const;

export const NEWS_CONFIG = {
  maxItems: 60,
  /** Report a road in the monthly traffic bulletin if its congestion changed by at least this (relative). */
  roadChangeThreshold: 0.08,
  maxRoadReportsPerMonth: 2,
} as const;
