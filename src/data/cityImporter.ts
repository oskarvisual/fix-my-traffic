import { env, isSupabaseConfigured } from '../config/env';
import type { CityDataBundle, CityRoadDataset, CityTransitDataset } from './cityDataset';
import { registerCustomCity, type CityCatalogEntry } from './cityCatalog';
import { registerCustomJurisdiction, type CityJurisdiction } from './jurisdictionBoundary';
import { IndexedDbStore, isIndexedDbAvailable } from '../storage/keyValueStore';
import { registerLoadedBundle } from '../app/cityLoader';

export interface OsmCitySearchResult {
  placeId: number;
  name: string;
  displayName: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // [south, west, north, east]
}

import type { RoadType } from '../config/traffic';

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const ROAD_TYPES: RoadType[] = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

const DEFAULT_LANES: Record<string, number> = {
  motorway: 4,
  trunk: 3,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

export async function searchOsmCities(query: string): Promise<OsmCitySearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    q,
  )}&format=json&addressdetails=1&featuretype=city&limit=6`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FixMyTrafficGame/1.0 (contact: admin@fixmytraffic.app)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Error en Nominatim: ${res.status}`);
  const data = (await res.json()) as Array<{
    place_id: number;
    name: string;
    display_name: string;
    lat: string;
    lon: string;
    boundingbox: [string, string, string, string]; // [latMin, latMax, lonMin, lonMax]
    address?: {
      country?: string;
      country_code?: string;
      city?: string;
      town?: string;
      municipality?: string;
      state?: string;
    };
  }>;

  return data.map((item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const south = parseFloat(item.boundingbox[0]);
    const north = parseFloat(item.boundingbox[1]);
    const west = parseFloat(item.boundingbox[2]);
    const east = parseFloat(item.boundingbox[3]);

    const cityName =
      item.address?.city ||
      item.address?.town ||
      item.address?.municipality ||
      item.name ||
      item.display_name.split(',')[0];

    const country = item.address?.country || 'Desconocido';
    const countryCode = (item.address?.country_code || 'UN').toUpperCase();

    return {
      placeId: item.place_id,
      name: cityName,
      displayName: item.display_name,
      country,
      countryCode,
      lat,
      lon,
      bbox: [south, west, north, east],
    };
  });
}

function haversineM(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[1] * Math.PI) / 180) *
      Math.cos((p2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function wayLengthM(coords: [number, number][]): number {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += haversineM(coords[i], coords[i + 1]);
  }
  return len;
}

// Monotone chain 2D convex hull algorithm
function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  function cross(o: [number, number], a: [number, number], b: [number, number]) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

async function fetchFromOverpass(query: string): Promise<any[]> {
  let lastErr: Error | null = null;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FixMyTrafficApp/1.0 (contact: admin@fixmytraffic.app)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.elements || [];
    } catch (err: any) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass API no disponible');
}

export async function importCity(
  cityMeta: OsmCitySearchResult,
  onProgress?: (step: string, pct: number) => void,
): Promise<{ cityId: string; name: string }> {
  const cityId = cityMeta.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  onProgress?.('📍 Locating central urban area...', 10);

  // Expanded metropolitan radius (~19km x 23km) for large cities
  const latDelta = 0.085;
  const lonDelta = 0.105;
  const bbox: [number, number, number, number] = [
    Math.round((cityMeta.lat - latDelta) * 1e4) / 1e4,
    Math.round((cityMeta.lon - lonDelta) * 1e4) / 1e4,
    Math.round((cityMeta.lat + latDelta) * 1e4) / 1e4,
    Math.round((cityMeta.lon + lonDelta) * 1e4) / 1e4,
  ];

  onProgress?.(`🛣️ Downloading real street network for ${cityMeta.name}...`, 30);

  const roadQuery = `[out:json][timeout:60];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](${bbox.join(',')});
out geom;`;

  const roadElements = await fetchFromOverpass(roadQuery);

  onProgress?.(`🚇 Mapping public transit routes (Metro, BRT, rail)...`, 55);

  const transitQuery = `[out:json][timeout:45];
relation["route"~"^(subway|light_rail|bus|tram)$"](${bbox.join(',')});
out tags geom 40;`;

  let transitElements: any[] = [];
  try {
    transitElements = await fetchFromOverpass(transitQuery);
  } catch (err) {
    console.warn('Transit fetch warning:', err);
  }

  onProgress?.('🧮 Building road graph and parallel detour corridors...', 75);

  const namesSet = new Set<string>();
  const validWays: Array<{
    id: string;
    name: string;
    roadType: RoadType;
    isLink: number;
    lanes: number;
    speed: number;
    oneway: number;
    lengthM: number;
    coordinates: [number, number][];
  }> = [];


  for (const el of roadElements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    let hw = el.tags?.highway || 'secondary';
    const isLink = hw.endsWith('_link') ? 1 : 0;
    if (isLink) hw = hw.replace('_link', '');
    if (!ROAD_TYPES.includes(hw as RoadType)) continue;

    const coords: [number, number][] = el.geometry.map((pt: any) => [
      Math.round(pt.lon * 1e5) / 1e5,
      Math.round(pt.lat * 1e5) / 1e5,
    ]);

    const lengthM = Math.round(wayLengthM(coords));
    if (lengthM < 25) continue;

    const name = el.tags?.name?.trim() || '';
    if (name) namesSet.add(name);

    const lanes = el.tags?.lanes ? parseInt(el.tags.lanes, 10) || DEFAULT_LANES[hw] : DEFAULT_LANES[hw];
    const speed = el.tags?.maxspeed ? parseInt(el.tags.maxspeed, 10) || 50 : 50;
    const oneway = el.tags?.oneway === 'yes' ? 1 : 0;

    validWays.push({
      id: `w${el.id}`,
      name,
      roadType: hw as RoadType,
      isLink,

      lanes: Math.min(6, Math.max(1, lanes)),
      speed,
      oneway,
      lengthM,
      coordinates: coords,
    });
  }

  const names = Array.from(namesSet);
  const nameToIdx = new Map(names.map((n, i) => [n, i]));

  const nodeMap = new Map<string, number>();
  const nodes: [number, number][] = [];
  const getNodeIdx = (pt: [number, number]) => {
    const key = `${pt[0]},${pt[1]}`;
    if (nodeMap.has(key)) return nodeMap.get(key)!;
    const idx = nodes.length;
    nodes.push(pt);
    nodeMap.set(key, idx);
    return idx;
  };

  const segments: any[] = [];
  for (let i = 0; i < validWays.length; i++) {
    const w = validWays[i];
    const nameIdx = w.name ? nameToIdx.get(w.name) ?? -1 : -1;
    const typeIdx = ROAD_TYPES.indexOf(w.roadType);
    const fromNode = getNodeIdx(w.coordinates[0]);
    const toNode = getNodeIdx(w.coordinates[w.coordinates.length - 1]);

    segments.push([
      w.id,
      nameIdx,
      typeIdx,
      w.lanes,
      w.speed,
      w.oneway,
      w.lengthM,
      fromNode,
      toNode,
      w.coordinates,
      [], // alternatives
      [], // twins
      w.isLink,
    ]);
  }

  // Calculate parallel alternative routes
  const segmentMidpoints = segments.map((s) => {
    const coords = s[9];
    return coords[Math.floor(coords.length / 2)] as [number, number];
  });

  for (let i = 0; i < segments.length; i++) {
    const midA = segmentMidpoints[i];
    const alts: [number, number][] = [];
    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      const d = haversineM(midA, segmentMidpoints[j]);
      if (d > 70 && d < 900) {
        const weight = Math.round((1 - d / 900) * 100) / 100;
        alts.push([j, weight]);
        if (alts.length >= 5) break;
      }
    }
    segments[i][10] = alts;
  }

  // Parse Transit routes
  const transitRoutes: any[] = [];
  const fallbackColors = ['#00e676', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
  let colorIdx = 0;

  for (const rel of transitElements) {
    if (rel.type !== 'relation' || !rel.members) continue;
    const rMode = rel.tags?.route || 'bus';
    const isSub =
      rMode === 'subway' ||
      rMode === 'light_rail' ||
      rel.tags?.tunnel === 'yes' ||
      rel.tags?.railway === 'subway';
    const lines: [number, number][][] = [];

    for (const m of rel.members) {
      if (m.type === 'way' && m.geometry && m.geometry.length >= 2) {
        lines.push(m.geometry.map((pt: any) => [Math.round(pt.lon * 1e5) / 1e5, Math.round(pt.lat * 1e5) / 1e5]));
      }
    }

    if (lines.length > 0) {
      transitRoutes.push({
        id: `rel-${rel.id}`,
        name: rel.tags?.name || rel.tags?.ref || `${rMode.toUpperCase()} Transit Line`,
        mode: isSub ? 'subway' : 'bus',
        subterranean: isSub,
        ref: rel.tags?.ref || '',
        colour: rel.tags?.colour || fallbackColors[colorIdx++ % fallbackColors.length],
        lines,
      });
      if (transitRoutes.length >= 40) break;
    }
  }

  // Compute Hull & Mask
  const sampleNodes = nodes.filter((_, idx) => idx % 5 === 0);
  const hull = computeConvexHull(sampleNodes);
  hull.push(hull[0]); // close ring

  const cameraBounds: [[number, number], [number, number]] = [
    [bbox[1] - 0.04, bbox[0] - 0.04],
    [bbox[3] + 0.04, bbox[2] + 0.04],
  ];

  const roadsDataset: CityRoadDataset = {
    schemaVersion: 1,
    city: {
      id: cityId,
      name: cityMeta.name,
      country: cityMeta.country,
      center: [cityMeta.lon, cityMeta.lat],
      bbox,
    },
    version: {
      datasetVersion: 1,
      generatedAt: new Date().toISOString(),
      roadNetworkVersion: `osm-${cityId}-v1`,
      dataSources: [
        {
          id: 'osm',
          name: 'OpenStreetMap',
          kind: 'real',
          license: 'ODbL-1.0',
          attribution: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
          retrievedAt: new Date().toISOString(),
        },
      ],
    },
    stats: {
      segmentCount: segments.length,
      nodeCount: nodes.length,
      totalKm: Math.round(segments.reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
      kmByType: {
        motorway: Math.round(segments.filter((s: any) => s[2] === 0).reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
        trunk: Math.round(segments.filter((s: any) => s[2] === 1).reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
        primary: Math.round(segments.filter((s: any) => s[2] === 2).reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
        secondary: Math.round(segments.filter((s: any) => s[2] === 3).reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
        tertiary: Math.round(segments.filter((s: any) => s[2] === 4).reduce((acc: number, s: any) => acc + s[6], 0) / 1000),
      },
    },
    roadTypes: ROAD_TYPES,
    names,
    nodes,
    segments,
  };

  const transitDataset: CityTransitDataset = {
    schemaVersion: 1,
    cityId,
    datasetVersion: 1,
    attribution: `© OpenStreetMap contributors · ${cityMeta.name} Transit`,
    routes: transitRoutes,
  };

  const totalKm = roadsDataset.stats.totalKm;
  const count = segments.length;

  let difficulty: 'easy' | 'normal' | 'hard' | 'extreme' = 'normal';
  let diffLabel = 'Medio';
  if (count < 3000) {
    difficulty = 'easy';
    diffLabel = 'Fácil';
  } else if (count > 4800) {
    difficulty = 'extreme';
    diffLabel = 'Muy Difícil';
  } else if (count > 3800) {
    difficulty = 'hard';
    diffLabel = 'Difícil';
  }

  const budget = Math.round(Math.max(500, Math.min(1500, count * 0.22))) * 1_000_000;

  // Jurisdiction & Fog of war
  const jurisdiction: CityJurisdiction = {
    cityId,
    name: cityMeta.name,
    cameraBounds,
    minZoom: 11.0,
    perimeterCoords: hull,
    invertedMask: {
      type: 'Feature',
      properties: { name: `Fuera de Jurisdicción (${cityMeta.name})` },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-180, -85],
            [180, -85],
            [180, 85],
            [-180, 85],
            [-180, -85],
          ],
          hull,
        ],
      },
    },
    perimeterLine: {
      type: 'Feature',
      properties: { name: `Límite Jurisdiccional de ${cityMeta.name}` },
      geometry: {
        type: 'LineString',
        coordinates: hull,
      },
    },
  };

  registerCustomJurisdiction(jurisdiction);

  const cityEntry: CityCatalogEntry = {
    id: cityId,
    name: cityMeta.name,
    country: cityMeta.country,
    flag: getFlagEmoji(cityMeta.countryCode),
    badgeCode: cityMeta.countryCode,
    latestDatasetVersion: 1,
    population: null,
    difficulty,
    difficultyLabel: diffLabel,
    initialBudget: budget,
    streetsCount: count,
    kmCount: totalKm,
    transitSummaryKey: `city.${cityId}.transit`,
    searchTerms: [cityMeta.name.toLowerCase(), cityMeta.country.toLowerCase(), cityId],
  };

  registerCustomCity(cityEntry);

  const bundle: CityDataBundle = { roads: roadsDataset, transit: transitDataset };
  registerLoadedBundle(cityId, 1, bundle);

  onProgress?.('☁️ Saving city dataset to Supabase and local cache...', 90);

  // Cache in IndexedDB
  if (isIndexedDbAvailable()) {
    try {
      const store = new IndexedDbStore('fmt-city-cache');
      await store.set(`${cityId}@1`, bundle);
      await store.set(`city:${cityId}@v1`, bundle);
      await store.set(`latest:${cityId}`, 1);
    } catch (e) {
      console.warn('Local cache error:', e);
    }
  }

  // Upload to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      await uploadToSupabase(cityId, cityMeta, roadsDataset, transitDataset);
    } catch (e) {
      console.warn('Supabase upload skipped/failed:', e);
    }
  }

  onProgress?.('🎉 City ready for office!', 100);

  return { cityId, name: cityMeta.name };
}

async function uploadToSupabase(
  cityId: string,
  cityMeta: OsmCitySearchResult,
  roads: CityRoadDataset,
  transit: CityTransitDataset,
) {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!url || !anonKey) return;

  const storageBase = `${url}/storage/v1/object/city-datasets`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'x-upsert': 'true',
  };

  // Upload roads.json
  await fetch(`${storageBase}/${cityId}/v1/roads.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify(roads),
  });

  // Upload transit.json
  await fetch(`${storageBase}/${cityId}/v1/transit.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify(transit),
  });

  // Insert city into city_datasets table
  await fetch(`${url}/rest/v1/city_datasets`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      city_id: cityId,
      name: cityMeta.name,
      country: cityMeta.country,
      center: [cityMeta.lon, cityMeta.lat],
      bbox: roads.city.bbox,
    }),
  });

  // Insert version
  await fetch(`${url}/rest/v1/city_dataset_versions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      city_id: cityId,
      dataset_version: 1,
      roads_bundle_path: `${cityId}/v1/roads.json`,
      transit_bundle_path: `${cityId}/v1/transit.json`,
      status: 'published',
    }),
  });
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .slice(0, 2)
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
