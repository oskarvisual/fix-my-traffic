/**
 * Traffic data abstraction. Providers return a BASELINE demand per road segment.
 * The simulation never knows where the numbers came from, so providers can be
 * swapped (mock -> historical dataset -> municipal open data) without touching it.
 */
import type { DataSource } from '../cityDataset';

export interface TrafficSnapshot {
  cityId: string;
  datasetVersion: number;
  providerId: string;
  /** True when values are game estimates rather than measured data. */
  isSimulated: boolean;
  /** Peak-hour car demand (vehicles/hour), index-aligned with RoadNetwork.segments. */
  baselineDemandVph: number[];
  provenance: DataSource;
}

export interface TrafficDataProvider {
  readonly id: string;
  getTrafficData(cityId: string): Promise<TrafficSnapshot>;
}
