import type { CityDataBundle } from './cityDataset';

/**
 * Source of shared, versioned city datasets. Implementations: static files
 * bundled with the app, Supabase (shared across players), and an IndexedDB cache
 * decorator so a dataset is downloaded once per version.
 */
export interface CityDataRepository {
  readonly id: string;
  /** Latest published dataset version, or null if the city is unknown here. */
  getLatestVersion(cityId: string): Promise<number | null>;
  loadCity(cityId: string, version: number): Promise<CityDataBundle>;
}

export class CityDataNotFoundError extends Error {
  constructor(cityId: string, version?: number) {
    super(`City dataset not found: ${cityId}${version ? ` v${version}` : ''}`);
  }
}
