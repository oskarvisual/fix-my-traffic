/**
 * Raw, versioned city dataset format as produced by scripts/build-city-dataset.mjs
 * and stored either as static files or in Supabase. Contains REAL source data only
 * (OpenStreetMap geometry/attributes) plus provenance. No traffic values here.
 */
import type { RoadType } from '../config/traffic';

export type LngLat = [number, number];

export interface DataSource {
  id: string;
  name: string;
  kind: 'real' | 'simulated';
  license: string;
  attribution: string;
  url: string;
  retrievedAt: string;
  notes?: string;
}

export interface DatasetVersionInfo {
  datasetVersion: number;
  generatedAt: string;
  roadNetworkVersion: string;
  dataSources: DataSource[];
}

/**
 * Tuple layout (kept compact for download size):
 * [id, nameIdx, typeIdx, lanes, speedKph, oneway, lengthM, fromNode, toNode,
 *  coordinates, alternatives [segIdx, weight][], twins segIdx[], isLink]
 */
export type DatasetSegmentTuple = [
  string,
  number,
  number,
  number,
  number,
  0 | 1,
  number,
  number,
  number,
  LngLat[],
  [number, number][],
  number[],
  0 | 1,
];

export interface CityRoadDataset {
  schemaVersion: 1;
  city: { id: string; name: string; country: string; center: LngLat; bbox: number[] };
  version: DatasetVersionInfo;
  stats: { segmentCount: number; nodeCount: number; totalKm: number; kmByType: Record<string, number> };
  roadTypes: RoadType[];
  names: string[];
  nodes: LngLat[];
  segments: DatasetSegmentTuple[];
}

export interface TransitRoute {
  id: string;
  name: string;
  mode: string;
  ref: string | null;
  colour: string | null;
  lines: LngLat[][];
}

export interface CityTransitDataset {
  schemaVersion: 1;
  cityId: string;
  datasetVersion: number;
  attribution: string;
  routes: TransitRoute[];
}

export interface CityDataBundle {
  roads: CityRoadDataset;
  transit: CityTransitDataset;
}

export function isCityRoadDataset(value: unknown): value is CityRoadDataset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CityRoadDataset>;
  return v.schemaVersion === 1 && Array.isArray(v.segments) && Array.isArray(v.names) && !!v.version;
}
