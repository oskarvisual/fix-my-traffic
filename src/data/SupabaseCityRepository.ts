import { isCityRoadDataset, type CityDataBundle, type CityTransitDataset } from './cityDataset';
import { CityDataNotFoundError, type CityDataRepository } from './CityDataRepository';

/**
 * Reads shared city datasets from Supabase using its REST (PostgREST) and
 * Storage endpoints directly, avoiding the supabase-js dependency for now.
 *
 * Schema: supabase/migrations/0001_city_datasets.sql. The client reads the
 * version row and downloads the pre-packaged bundle referenced by
 * `roads_bundle_path` / `transit_bundle_path` from the public `city-datasets`
 * bucket. Normalized tables exist for server-side analysis and future tooling.
 */
export class SupabaseCityRepository implements CityDataRepository {
  readonly id = 'supabase';

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  private headers(): HeadersInit {
    return { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}` };
  }

  private async versionRow(cityId: string, version?: number) {
    const params = new URLSearchParams({
      select: 'dataset_version,roads_bundle_path,transit_bundle_path',
      city_id: `eq.${cityId}`,
      status: 'eq.published',
      order: 'dataset_version.desc',
      limit: '1',
    });
    if (version !== undefined) params.set('dataset_version', `eq.${version}`);
    const res = await this.fetchImpl(`${this.url}/rest/v1/city_dataset_versions?${params}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}`);
    const rows = (await res.json()) as {
      dataset_version: number;
      roads_bundle_path: string;
      transit_bundle_path: string | null;
    }[];
    return rows[0] ?? null;
  }

  async getLatestVersion(cityId: string): Promise<number | null> {
    return (await this.versionRow(cityId))?.dataset_version ?? null;
  }

  async loadCity(cityId: string, version: number): Promise<CityDataBundle> {
    const row = await this.versionRow(cityId, version);
    if (!row) throw new CityDataNotFoundError(cityId, version);
    const storage = `${this.url}/storage/v1/object/public/city-datasets`;
    const roadsRes = await this.fetchImpl(`${storage}/${row.roads_bundle_path}`);
    if (!roadsRes.ok) throw new CityDataNotFoundError(cityId, version);
    const roads: unknown = await roadsRes.json();
    if (!isCityRoadDataset(roads)) throw new Error('Invalid dataset bundle from Supabase');
    let transit: CityTransitDataset = { schemaVersion: 1, cityId, datasetVersion: version, attribution: '', routes: [] };
    if (row.transit_bundle_path) {
      const tRes = await this.fetchImpl(`${storage}/${row.transit_bundle_path}`);
      if (tRes.ok) transit = (await tRes.json()) as CityTransitDataset;
    }
    return { roads, transit };
  }
}
