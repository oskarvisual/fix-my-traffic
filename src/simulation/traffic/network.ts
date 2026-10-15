/**
 * Runtime road graph. Immutable once built; all dynamic traffic values live in
 * TrafficState arrays indexed by `RoadSegment.index`.
 */
import { TRAFFIC_CONFIG, type RoadType } from '../../config/traffic';
import type { CityRoadDataset, LngLat } from '../../data/cityDataset';

export interface Alternative {
  index: number;
  /** Proximity weight (0..1], higher = closer / more attractive. */
  weight: number;
}

export interface RoadSegment {
  index: number;
  id: string;
  name: string;
  roadType: RoadType;
  lanes: number;
  speedLimitKph: number;
  lengthM: number;
  oneway: boolean;
  isLink: boolean;
  fromNode: number;
  toNode: number;
  coordinates: LngLat[];
  alternatives: Alternative[];
  /** Same-street segments running in parallel (e.g. the other carriageway). */
  twins: number[];
  /** Peak-hour capacity, vehicles/hour, before any modifier. */
  baseCapacity: number;
}

export interface RoadNetwork {
  cityId: string;
  datasetVersion: number;
  segments: RoadSegment[];
  nodes: LngLat[];
  /** Segment indices touching each node. */
  nodeSegments: number[][];
  indexById: Map<string, number>;
}

export function segmentCapacity(roadType: RoadType, lanes: number): number {
  return TRAFFIC_CONFIG.laneCapacityVph[roadType] * Math.max(1, lanes);
}

export function buildRoadNetwork(dataset: CityRoadDataset): RoadNetwork {
  const segments: RoadSegment[] = dataset.segments.map((t, index) => {
    const roadType = dataset.roadTypes[t[2]];
    return {
      index,
      id: t[0],
      name: dataset.names[t[1]] ?? '',
      roadType,
      lanes: t[3],
      speedLimitKph: t[4],
      oneway: t[5] === 1,
      lengthM: t[6],
      fromNode: t[7],
      toNode: t[8],
      coordinates: t[9],
      alternatives: t[10].map(([i, w]) => ({ index: i, weight: w })),
      twins: t[11],
      isLink: t[12] === 1,
      baseCapacity: segmentCapacity(roadType, t[3]),
    };
  });
  const nodeSegments: number[][] = dataset.nodes.map(() => []);
  for (const s of segments) {
    nodeSegments[s.fromNode]?.push(s.index);
    if (s.toNode !== s.fromNode) nodeSegments[s.toNode]?.push(s.index);
  }
  return {
    cityId: dataset.city.id,
    datasetVersion: dataset.version.datasetVersion,
    segments,
    nodes: dataset.nodes,
    nodeSegments,
    indexById: new Map(segments.map((s) => [s.id, s.index])),
  };
}

/** Segments that share a node with the given segment. */
export function connectedSegments(network: RoadNetwork, index: number): number[] {
  const s = network.segments[index];
  const out = new Set<number>();
  for (const node of [s.fromNode, s.toNode]) {
    for (const j of network.nodeSegments[node] ?? []) if (j !== index) out.add(j);
  }
  return [...out];
}

/**
 * Expands a seed segment to the contiguous street with the same name (both
 * carriageways), closest-first, stopping at `maxLengthM`.
 */
export function expandStreet(network: RoadNetwork, seed: number, maxLengthM: number): number[] {
  const name = network.segments[seed]?.name;
  if (!name) return [seed];
  const visited = new Set<number>([seed]);
  const queue = [seed];
  let length = 0;
  const result: number[] = [];
  while (queue.length) {
    const i = queue.shift() as number;
    const seg = network.segments[i];
    if (length + seg.lengthM > maxLengthM && result.length > 0) break;
    result.push(i);
    length += seg.lengthM;
    for (const j of [...connectedSegments(network, i), ...seg.twins]) {
      if (!visited.has(j) && network.segments[j].name === name && !network.segments[j].isLink) {
        visited.add(j);
        queue.push(j);
      }
    }
  }
  return result;
}

/**
 * Returns all segments belonging to the whole avenue / corridor of the seed segment.
 * If the avenue has a name (e.g. "Avenida Brasil", "Avenida Arequipa"), all segments
 * across both carriageways and blocks are returned. If unnamed, expands along connected segments.
 */
export function getAllAvenueSegments(network: RoadNetwork, seedIndex: number): number[] {
  const seed = network.segments[seedIndex];
  if (!seed) return [];
  if (!seed.name || seed.name.trim().length === 0) {
    return expandStreet(network, seedIndex, 12000);
  }
  const targetName = seed.name.trim().toLowerCase();
  const matching: number[] = [];
  for (let i = 0; i < network.segments.length; i++) {
    const s = network.segments[i];
    if (s.name && s.name.trim().toLowerCase() === targetName) {
      matching.push(i);
    }
  }
  return matching.length > 0 ? matching : [seedIndex];
}

export function corridorLengthKm(network: RoadNetwork, indices: readonly number[]): number {
  return indices.reduce((sum, i) => sum + (network.segments[i]?.lengthM ?? 0), 0) / 1000;
}

/** Corridor length counting parallel carriageways once (used for costing). */
export function corridorStreetKm(network: RoadNetwork, indices: readonly number[]): number {
  const set = new Set(indices);
  let meters = 0;
  const counted = new Set<number>();
  for (const i of indices) {
    const seg = network.segments[i];
    const twinCounted = seg.twins.some((t) => set.has(t) && counted.has(t));
    counted.add(i);
    if (!twinCounted) meters += seg.lengthM;
  }
  return meters / 1000;
}
