import { findCity } from './cityCatalog';
import { isCityRoadDataset, type CityDataBundle, type CityTransitDataset } from './cityDataset';
import { CityDataNotFoundError, type CityDataRepository } from './CityDataRepository';

/** Loads datasets shipped under public/data/cities/<id>/v<version>/. */
export class StaticCityRepository implements CityDataRepository {
  readonly id = 'static';

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getLatestVersion(cityId: string): Promise<number | null> {
    return findCity(cityId)?.latestDatasetVersion ?? null;
  }

  async loadCity(cityId: string, version: number): Promise<CityDataBundle> {
    const dir = `${this.baseUrl.replace(/\/$/, '')}/data/cities/${cityId}/v${version}`;
    const res = await this.fetchImpl(`${dir}/roads.json`);
    if (!res.ok) throw new CityDataNotFoundError(cityId, version);
    const roads: unknown = await res.json();
    if (!isCityRoadDataset(roads)) throw new Error(`Invalid dataset format for ${cityId} v${version}`);

    let transit: CityTransitDataset = {
      schemaVersion: 1,
      cityId,
      datasetVersion: version,
      attribution: '',
      routes: [],
    };
    const transitRes = await this.fetchImpl(`${dir}/transit.json`).catch(() => null);
    if (transitRes?.ok) transit = (await transitRes.json()) as CityTransitDataset;
    return { roads, transit };
  }
}
