import type { CityDataBundle } from '../data/cityDataset';
import type { CityDataRepository } from '../data/CityDataRepository';
import type { KeyValueStore } from './keyValueStore';

/** Decorator caching immutable dataset versions locally (IndexedDB). */
export class CachedCityRepository implements CityDataRepository {
  readonly id: string;

  constructor(
    private readonly inner: CityDataRepository,
    private readonly cache: KeyValueStore,
  ) {
    this.id = `cached:${inner.id}`;
  }

  async getLatestVersion(cityId: string): Promise<number | null> {
    const cached = await this.cache.get<number>(`latest:${cityId}`).catch(() => undefined);
    if (typeof cached === 'number') return cached;
    const v = await this.inner.getLatestVersion(cityId);
    if (v !== null) {
      await this.cache.set(`latest:${cityId}`, v).catch(() => undefined);
    }
    return v;
  }

  async loadCity(cityId: string, version: number): Promise<CityDataBundle> {
    const key = `city:${cityId}@v${version}`;
    const cached = await this.cache.get<CityDataBundle>(key).catch(() => undefined);
    if (cached) return cached;
    const altCached = await this.cache.get<CityDataBundle>(`${cityId}@${version}`).catch(() => undefined);
    if (altCached) return altCached;
    const bundle = await this.inner.loadCity(cityId, version);
    await this.cache.set(key, bundle).catch(() => undefined);
    return bundle;
  }

}

/** Tries repositories in order (e.g. Supabase, then static files). */
export class FallbackCityRepository implements CityDataRepository {
  readonly id: string;

  constructor(private readonly repos: CityDataRepository[]) {
    this.id = repos.map((r) => r.id).join('>');
  }

  async getLatestVersion(cityId: string): Promise<number | null> {
    for (const repo of this.repos) {
      const v = await repo.getLatestVersion(cityId).catch(() => null);
      if (v !== null) return v;
    }
    return null;
  }

  async loadCity(cityId: string, version: number): Promise<CityDataBundle> {
    let lastError: unknown;
    for (const repo of this.repos) {
      try {
        return await repo.loadCity(cityId, version);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
