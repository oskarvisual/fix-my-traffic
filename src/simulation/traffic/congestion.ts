import { CONGESTION_LEVELS, TRAFFIC_CONFIG, type CongestionLevelId } from '../../config/traffic';

/** Maps a volume/capacity ratio to the 0..1 congestion score. */
export function congestionFromVc(vc: number): number {
  const { vcFree, vcJam } = TRAFFIC_CONFIG;
  if (!Number.isFinite(vc)) return 1;
  return Math.min(1, Math.max(0, (vc - vcFree) / (vcJam - vcFree)));
}

export function congestionLevel(score: number): CongestionLevelId {
  for (const level of CONGESTION_LEVELS) if (score < level.max) return level.id;
  return 'extreme';
}

/** Estimated average speed using the BPR volume-delay function. */
export function estimatedSpeedKph(speedLimitKph: number, vc: number): number {
  const { bprAlpha, bprBeta } = TRAFFIC_CONFIG;
  // Free-flow urban speed is below the posted limit (signals, crossings).
  const freeFlow = speedLimitKph * 0.85;
  return freeFlow / (1 + bprAlpha * Math.pow(Math.max(0, vc), bprBeta));
}

/** Travel-time multiplier relative to free flow (1 = no delay). */
export function delayFactor(vc: number): number {
  const { bprAlpha, bprBeta } = TRAFFIC_CONFIG;
  return 1 + bprAlpha * Math.pow(Math.max(0, vc), bprBeta);
}
