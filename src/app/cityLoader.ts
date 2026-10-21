/**
 * Wires data sources together: city repository -> road network ->
 * traffic provider baseline. Returns everything the simulation needs.
 */
import { env } from '../config/env';
import type { CityDataBundle } from '../data/cityDataset';
import type { CityDataRepository } from '../data/CityDataRepository';
import { StaticCityRepository } from '../data/StaticCityRepository';
import { MockTrafficProvider } from '../data/traffic/MockTrafficProvider';
import type { TrafficSnapshot } from '../data/traffic/TrafficDataProvider';
import type { SimulationContext } from '../simulation/game';
import { hashString } from '../simulation/random';
import { buildRoadNetwork } from '../simulation/traffic/network';
import { CachedCityRepository } from '../storage/cityCache';
import { IndexedDbStore, isIndexedDbAvailable } from '../storage/keyValueStore';

export interface LoadedCity {
  bundle: CityDataBundle;
  ctx: SimulationContext;
  traffic: TrafficSnapshot;
}

let repository: CityDataRepository | null = null;

export function getCityRepository(): CityDataRepository {
  if (repository) return repository;
  const staticRepo = new StaticCityRepository(env.baseUrl);
  repository = isIndexedDbAvailable()
    ? new CachedCityRepository(staticRepo, new IndexedDbStore('fmt-city-cache'))
    : staticRepo;
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

export function registerLoadedBundle(cityId: string, version: number, bundle: CityDataBundle): void {
  const network = buildRoadNetwork(bundle.roads);
  const provider = new MockTrafficProvider(network, hashString(`baseline:${cityId}`));
  const promise = provider.getTrafficData(cityId).then((traffic) => ({
    bundle,
    traffic,
    ctx: { network, baselineDemand: traffic.baselineDemandVph },
  }));
  loaded.set(`${cityId}@${version}`, promise);
  loaded.set(`${cityId}@latest`, promise);
}


