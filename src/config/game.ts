/** Time, economy, corruption and politics balance values. */
export const TIME_CONFIG = {
  /** 1 real minute (60 seconds) = 1 simulated game day at 1x speed. */
  realSecondsPerSimDayAt1x: 60,
  speeds: [0, 1, 5, 15, 30] as const,
  /** Debug-only speed multiplier. */
  debugTurboSpeed: 2400,
  /** Safety cap so a long frame never simulates huge chunks at once. */
  maxSimDaysPerFrame: 5,
  startDate: '2027-01-01',
  termYears: 5,
  daysPerTerm: 5 * 365, // 1,825 days
} as const;

export type SpeedSetting = number;

export const ECONOMY_CONFIG = {
  annualTransportBudget: 650_000_000,
  initialPublicBudget: 750_000_000,
  ministerMonthlySalary: 5_500,
  initialPersonalBalance: 20_000,
} as const;

export const POLITICS_CONFIG = {
  initialApproval: 0.52,
  /** Approval moves this fraction toward its target each month. */
  monthlyApprovalInertia: 0.25,
  /** Approval change per 0.01 of network congestion improvement vs. start. */
  approvalPerCongestionPoint: 0.014,
  constructionDisruptionPenalty: 0.025,
  completedProjectBonus: 0.02,
  maxCompletedProjectBonus: 0.15,
  minApproval: 0.01,
  maxApproval: 0.98,
  /** Impeachment threshold: if approval drops below this, impeachment warning / censura. */
  impeachmentThreshold: 0.20,
  /** Election victory threshold after 5 years. */
  electionWinThreshold: 0.48,
} as const;

export const CORRUPTION_CONFIG = {
  /** Risk threshold above which the Comptroller / Prosecutor opens an investigation. */
  investigationRiskThreshold: 0.35,
  /** Monthly check probability of investigation if threshold is crossed. */
  investigationMonthlyChance: 0.25,
  /** Arrest / destitution threshold for extreme corruption. */
  arrestThreshold: 0.85,
  /** Approval loss if corruption scandal breaks. */
  scandalApprovalPenalty: 0.28,
} as const;

export const NEWS_CONFIG = {
  maxItems: 60,
  /** Report a road in the monthly traffic bulletin if its congestion changed by at least this (relative). */
  roadChangeThreshold: 0.08,
  maxRoadReportsPerMonth: 3,
} as const;
