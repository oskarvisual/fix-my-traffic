import { balance } from './config';
import type { RoadSegment } from '../domain/types';

export function congestionFor(road: RoadSegment): number {
  const capacity = road.baseCapacity * road.capacityModifier;
  const demand = road.baselineDemand * road.demandModifier;
  if (capacity <= 0) return 1;
  return Math.max(0, Math.min(1, (demand / capacity - 0.65) / 0.65));
}

export function recalculateRoads(roads: RoadSegment[]): RoadSegment[] {
  return roads.map((road) => ({ ...road, congestion: congestionFor(road) }));
}

export function redistributeTraffic(roads: RoadSegment[], changedRoadId: string, displacedDemand: number): RoadSegment[] {
  const changed = roads.find((road) => road.id === changedRoadId);
  if (!changed || changed.adjacentIds.length === 0) return recalculateRoads(roads);
  const addition = (displacedDemand * balance.redistribution.adjacentShare) / changed.adjacentIds.length;
  return recalculateRoads(roads.map((road) => changed.adjacentIds.includes(road.id)
    ? { ...road, demandModifier: road.demandModifier + addition / road.baselineDemand }
    : road));
}
