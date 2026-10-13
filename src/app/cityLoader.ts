/**
 * Wires data sources together: city repository chain -> road network ->
 * traffic provider baseline. Returns everything the simulation needs.
 */
import { env, isSupabaseConfigured } from '../config/env';
import type { CityDataBundle } from '../data/cityDataset';
import type { CityDataRepository } from '../data/CityDataRepository';
import { StaticCityRepository } from '../data/StaticCityRepository';
import { SupabaseCityRepository } from '../data/SupabaseCityRepository';
import { MockTrafficProvider } from '../data/traffic/MockTrafficProvider';
import type { TrafficSnapshot } from '../data/traffic/TrafficDataProvider';
import type { SimulationContext } from '../simulation/game';
import { hashString } from '../simulation/random';
import { buildRoadNetwork } from '../simulation/traffic/network';
import { CachedCityRepository, FallbackCityRepository } from '../storage/cityCache';
import { IndexedDbStore, isIndexedDbAvailable } from '../storage/keyValueStore';

export interface LoadedCity {
  bundle: CityDataBundle;
  ctx: SimulationContext;
  traffic: TrafficSnapshot;
}

let repository: CityDataRepository | null = null;

export function getCityRepository(): CityDataRepository {
  if (repository) return repository;
  const sources: CityDataRepository[] = [];
  if (isSupabaseConfigured()) {
    sources.push(new SupabaseCityRepository(env.supabaseUrl as string, env.supabaseAnonKey as string));
  }
  sources.push(new StaticCityRepository(env.baseUrl));
  const chain = new FallbackCityRepository(sources);
  repository = isIndexedDbAvailable()
    ? new CachedCityRepository(chain, new IndexedDbStore('fmt-city-cache'))
    : chain;
  return repository;
}

const loaded = new Map<string, Promise<LoadedCity>>();

export function loadCity(cityId: string, version?: number): Promise<LoadedCity> {
  const key = `${cityId}@${version ?? 'latest'}`;
  const existing = loaded.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const repo = getCityRepository();
    const v = version ?? (await repo.getLatestVersion(cityId));
    if (v === null) throw new Error(`Unknown city ${cityId}`);
    const bundle = await repo.loadCity(cityId, v);
    const network = buildRoadNetwork(bundle.roads);
    // A fixed per-city seed keeps the shared baseline identical for every player.
    const provider = new MockTrafficProvider(network, hashString(`baseline:${cityId}`));
    const traffic = await provider.getTrafficData(cityId);
    return { bundle, traffic, ctx: { network, baselineDemand: traffic.baselineDemandVph } };
  })();
  loaded.set(key, promise);
  promise.catch(() => loaded.delete(key));
  return promise;
}
