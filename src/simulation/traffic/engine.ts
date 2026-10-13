/**
 * Macroscopic traffic engine. Operates on per-segment arrays; never on vehicles.
 *
 *   baseline demand x demand modifiers x growth  -> own demand
 *   base capacity   x capacity modifiers         -> capacity
 *   capacity loss -> diversion to parallel alternatives (redistribution)
 *   demand / capacity -> congestion score
 */
import { TRAFFIC_CONFIG } from '../../config/traffic';
import { congestionFromVc } from './congestion';
import type { RoadNetwork } from './network';

export interface TrafficModifiers {
  /** Multiplier on base capacity (1 = unchanged). */
  capacityFactor: Float32Array;
  /** Multiplier on own car demand (1 = unchanged). */
  demandFactor: Float32Array;
}

export interface TrafficState {
  capacity: Float32Array;
  ownDemand: Float32Array;
  currentDemand: Float32Array;
  vc: Float32Array;
  congestion: Float32Array;
}

export function createModifiers(segmentCount: number): TrafficModifiers {
  return {
    capacityFactor: new Float32Array(segmentCount).fill(1),
    demandFactor: new Float32Array(segmentCount).fill(1),
  };
}

export function applyCapacityChange(
  modifiers: TrafficModifiers,
  indices: Iterable<number>,
  factor: number,
): void {
  for (const i of indices) modifiers.capacityFactor[i] *= Math.max(0, factor);
}

export function applyDemandChange(
  modifiers: TrafficModifiers,
  indices: Iterable<number>,
  factor: number,
): void {
  for (const i of indices) modifiers.demandFactor[i] *= Math.max(0, factor);
}

/**
 * Moves demand away from segments that lost capacity toward their parallel
 * alternatives, weighted by proximity and spare capacity. A configurable share
 * of diverted trips is suppressed. Returns the resulting demand per segment.
 */
export function redistributeTraffic(
  network: RoadNetwork,
  ownDemand: Float32Array,
  capacity: Float32Array,
  capacityFactor: Float32Array,
): Float32Array {
  const {
    diversionElasticity,
    maxDiversionShare,
    suppressedShareOfDiverted,
    minSpareWeight,
  } = TRAFFIC_CONFIG;
  const result = Float32Array.from(ownDemand);
  for (let i = 0; i < network.segments.length; i++) {
    const loss = 1 - capacityFactor[i];
    if (loss <= 0) continue;
    const alts = network.segments[i].alternatives;
    if (alts.length === 0) continue;
    const share = Math.min(maxDiversionShare, loss * diversionElasticity);
    const diverted = ownDemand[i] * share;
    if (diverted <= 0) continue;
    result[i] -= diverted;
    const toMove = diverted * (1 - suppressedShareOfDiverted);
    let totalWeight = 0;
    const weights = alts.map((a) => {
      const cap = capacity[a.index];
      const spare = cap > 0 ? Math.max(minSpareWeight, (cap - ownDemand[a.index]) / cap) : 0;
      const w = a.weight * spare;
      totalWeight += w;
      return w;
    });
    if (totalWeight <= 0) continue;
    alts.forEach((a, k) => {
      result[a.index] += toMove * (weights[k] / totalWeight);
    });
  }
  return result;
}

export function calculateCongestion(demand: Float32Array, capacity: Float32Array) {
  const vc = new Float32Array(demand.length);
  const congestion = new Float32Array(demand.length);
  for (let i = 0; i < demand.length; i++) {
    vc[i] = capacity[i] > 0 ? demand[i] / capacity[i] : 10;
    congestion[i] = congestionFromVc(vc[i]);
  }
  return { vc, congestion };
}

export function computeTraffic(
  network: RoadNetwork,
  baselineDemand: ArrayLike<number>,
  modifiers: TrafficModifiers,
  demandGrowth = 1,
): TrafficState {
  const n = network.segments.length;
  const capacity = new Float32Array(n);
  const ownDemand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    capacity[i] = network.segments[i].baseCapacity * modifiers.capacityFactor[i];
    ownDemand[i] = baselineDemand[i] * modifiers.demandFactor[i] * demandGrowth;
  }
  const currentDemand = redistributeTraffic(network, ownDemand, capacity, modifiers.capacityFactor);
  const { vc, congestion } = calculateCongestion(currentDemand, capacity);
  return { capacity, ownDemand, currentDemand, vc, congestion };
}

/** Length-weighted mean congestion over a set of segments (all if omitted). */
export function averageCongestion(
  network: RoadNetwork,
  state: Pick<TrafficState, 'congestion'>,
  indices?: Iterable<number>,
): number {
  let sum = 0;
  let len = 0;
  const iter = indices ?? network.segments.map((s) => s.index);
  for (const i of iter) {
    const l = network.segments[i].lengthM;
    sum += state.congestion[i] * l;
    len += l;
  }
  return len > 0 ? sum / len : 0;
}

/** Background demand growth multiplier after `days` simulated days. */
export function demandGrowthFactor(days: number): number {
  return Math.pow(1 + TRAFFIC_CONFIG.annualDemandGrowth, days / 365);
}
