export const balance = {
  bikeLane: { cost: 18_000_000, durationMonths: 6, constructionCapacityPenalty: 0.28, completedDemandReduction: 0.16 },
  congestion: { freeFlow: 0.35, moderate: 0.55, heavy: 0.75, severe: 0.9 },
  redistribution: { adjacentShare: 0.22 },
  startingBudget: 850_000_000,
} as const;
