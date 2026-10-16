import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROAD_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const DEFAULT_LANES = {
  motorway: 4,
  trunk: 3,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

const ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const CITIES = {
  buenos_aires: {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    center: [-58.417, -34.603],
    bbox: [-34.650, -58.485, -34.560, -58.355], // [south, west, north, east]
    budget: 850_000_000,
    difficulty: 'easy',
    transitAttribution: '© OpenStreetMap contributors · Emova Movilidad S.A. · Subte de Buenos Aires',
    transitRoutes: [
      {
        id: 'subte-a',
        name: 'Línea A del Subte (Plaza de Mayo — San Pedrito)',
        mode: 'subway',
        subterranean: true,
        ref: 'A',
        colour: '#1ca4cb',
        lines: [
          [
            [-58.371, -34.608],
            [-58.384, -34.609],
            [-58.397, -34.609],
            [-58.410, -34.610],
            [-58.423, -34.614],
            [-58.435, -34.618],
            [-58.448, -34.621],
            [-58.462, -34.625],
            [-58.472, -34.629],
          ],
        ],
      },
      {
        id: 'subte-b',
        name: 'Línea B del Subte (Leandro N. Alem — J.M. de Rosas)',
        mode: 'subway',
        subterranean: true,
        ref: 'B',
        colour: '#c20924',
        lines: [
          [
            [-58.370, -34.603],
            [-58.383, -34.604],
            [-58.396, -34.604],
            [-58.411, -34.604],
            [-58.428, -34.604],
            [-58.444, -34.596],
            [-58.462, -34.587],
            [-58.478, -34.577],
          ],
        ],
      },
      {
        id: 'subte-c',
        name: 'Línea C del Subte (Retiro — Constitución)',
        mode: 'subway',
        subterranean: true,
        ref: 'C',
        colour: '#003ea1',
        lines: [
          [
            [-58.375, -34.592],
            [-58.379, -34.598],
            [-58.381, -34.604],
            [-58.381, -34.612],
            [-58.381, -34.620],
            [-58.381, -34.628],
          ],
        ],
      },
      {
        id: 'subte-d',
        name: 'Línea D del Subte (Catedral — Congreso de Tucumán)',
        mode: 'subway',
        subterranean: true,
        ref: 'D',
        colour: '#217861',
        lines: [
          [
            [-58.374, -34.608],
            [-58.380, -34.601],
            [-58.388, -34.595],
            [-58.399, -34.590],
            [-58.412, -34.584],
            [-58.423, -34.579],
            [-58.438, -34.572],
            [-58.452, -34.563],
            [-58.462, -34.555],
          ],
        ],
      },
      {
        id: 'subte-e',
        name: 'Línea E del Subte (Retiro — Plaza de los Virreyes)',
        mode: 'subway',
        subterranean: true,
        ref: 'E',
        colour: '#6b297e',
        lines: [
          [
            [-58.374, -34.592],
            [-58.371, -34.602],
            [-58.375, -34.609],
            [-58.382, -34.618],
            [-58.393, -34.623],
            [-58.407, -34.626],
            [-58.423, -34.629],
            [-58.442, -34.636],
            [-58.462, -34.643],
          ],
        ],
      },
      {
        id: 'subte-h',
        name: 'Línea H del Subte (Facultad de Derecho — Hospitales)',
        mode: 'subway',
        subterranean: true,
        ref: 'H',
        colour: '#f4cc21',
        lines: [
          [
            [-58.391, -34.583],
            [-58.398, -34.594],
            [-58.404, -34.604],
            [-58.408, -34.614],
            [-58.410, -34.624],
            [-58.411, -34.634],
            [-58.412, -34.642],
          ],
        ],
      },
      {
        id: 'metrobus-9julio',
        name: 'Metrobús 9 de Julio (Retiro — Constitución)',
        mode: 'bus',
        ref: 'MB9J',
        colour: '#f59e0b',
        lines: [
          [
            [-58.379, -34.594],
            [-58.380, -34.600],
            [-58.382, -34.606],
            [-58.381, -34.614],
            [-58.380, -34.623],
            [-58.381, -34.628],
          ],
        ],
      },
    ],
  },

  santiago: {
    id: 'santiago',
    name: 'Santiago',
    country: 'Chile',
    center: [-70.650, -33.445],
    bbox: [-33.485, -70.720, -33.405, -70.580], // [south, west, north, east]
    budget: 750_000_000,
    difficulty: 'normal',
    transitAttribution: '© OpenStreetMap contributors · Metro de Santiago · Red Movilidad',
    transitRoutes: [
      {
        id: 'metro-scl-l1',
        name: 'Línea 1 del Metro de Santiago (San Pablo — Los Dominicos)',
        mode: 'subway',
        subterranean: true,
        ref: 'L1',
        colour: '#e11d48',
        lines: [
          [
            [-70.718, -33.446],
            [-70.697, -33.450],
            [-70.678, -33.451],
            [-70.660, -33.447],
            [-70.648, -33.443],
            [-70.634, -33.437],
            [-70.618, -33.428],
            [-70.602, -33.418],
            [-70.585, -33.411],
          ],
        ],
      },
      {
        id: 'metro-scl-l2',
        name: 'Línea 2 del Metro de Santiago (Vespucio Norte — Hospital El Pino)',
        mode: 'subway',
        subterranean: true,
        ref: 'L2',
        colour: '#eab308',
        lines: [
          [
            [-70.654, -33.410],
            [-70.652, -33.425],
            [-70.652, -33.438],
            [-70.652, -33.448],
            [-70.651, -33.462],
            [-70.651, -33.475],
            [-70.653, -33.488],
          ],
        ],
      },
      {
        id: 'metro-scl-l3',
        name: 'Línea 3 del Metro de Santiago (Plaza Quilicura — F. Castillo Velasco)',
        mode: 'subway',
        subterranean: true,
        ref: 'L3',
        colour: '#92400e',
        lines: [
          [
            [-70.675, -33.410],
            [-70.660, -33.425],
            [-70.653, -33.435],
            [-70.648, -33.444],
            [-70.635, -33.450],
            [-70.615, -33.453],
            [-70.595, -33.454],
            [-70.575, -33.450],
          ],
        ],
      },
      {
        id: 'metro-scl-l5',
        name: 'Línea 5 del Metro de Santiago (Plaza de Maipú — Vicente Valdés)',
        mode: 'subway',
        subterranean: true,
        ref: 'L5',
        colour: '#16a34a',
        lines: [
          [
            [-70.710, -33.440],
            [-70.686, -33.440],
            [-70.665, -33.440],
            [-70.648, -33.438],
            [-70.633, -33.438],
            [-70.627, -33.450],
            [-70.618, -33.468],
            [-70.605, -33.485],
          ],
        ],
      },
      {
        id: 'metro-scl-l6',
        name: 'Línea 6 del Metro de Santiago (Cerrillos — Los Leones)',
        mode: 'subway',
        subterranean: true,
        ref: 'L6',
        colour: '#9333ea',
        lines: [
          [
            [-70.705, -33.488],
            [-70.680, -33.482],
            [-70.655, -33.475],
            [-70.635, -33.462],
            [-70.612, -33.445],
            [-70.604, -33.422],
          ],
        ],
      },
      {
        id: 'red-alameda',
        name: 'Corredor Alameda — Providencia (Red Movilidad BRT)',
        mode: 'bus',
        ref: 'RED',
        colour: '#f97316',
        lines: [
          [
            [-70.700, -33.451],
            [-70.678, -33.451],
            [-70.658, -33.447],
            [-70.645, -33.442],
            [-70.632, -33.435],
            [-70.618, -33.426],
            [-70.603, -33.418],
          ],
        ],
      },
    ],
  },

  cdmx: {
    id: 'cdmx',
    name: 'Ciudad de México',
    country: 'México',
    center: [-99.145, 19.432],
    bbox: [19.370, -99.220, 19.475, -99.080], // [south, west, north, east]
    budget: 1_400_000_000,
    difficulty: 'extreme',
    transitAttribution: '© OpenStreetMap contributors · STC Metro CDMX · Metrobús CDMX',
    transitRoutes: [
      {
        id: 'metro-cdmx-l1',
        name: 'Línea 1 del Metro CDMX (Observatorio — Pantitlán)',
        mode: 'subway',
        subterranean: true,
        ref: 'L1',
        colour: '#ec4899',
        lines: [
          [
            [-99.200, 19.398],
            [-99.187, 19.404],
            [-99.175, 19.418],
            [-99.162, 19.426],
            [-99.150, 19.428],
            [-99.138, 19.427],
            [-99.124, 19.428],
            [-99.100, 19.423],
            [-99.072, 19.416],
          ],
        ],
      },
      {
        id: 'metro-cdmx-l2',
        name: 'Línea 2 del Metro CDMX (Cuatro Caminos — Tasqueña)',
        mode: 'subway',
        subterranean: true,
        ref: 'L2',
        colour: '#3b82f6',
        lines: [
          [
            [-99.215, 19.458],
            [-99.190, 19.456],
            [-99.168, 19.448],
            [-99.148, 19.437],
            [-99.133, 19.433],
            [-99.133, 19.420],
            [-99.135, 19.400],
            [-99.138, 19.378],
          ],
        ],
      },
      {
        id: 'metro-cdmx-l3',
        name: 'Línea 3 del Metro CDMX (Indios Verdes — Universidad)',
        mode: 'subway',
        subterranean: true,
        ref: 'L3',
        colour: '#84cc16',
        lines: [
          [
            [-99.122, 19.475],
            [-99.138, 19.460],
            [-99.147, 19.444],
            [-99.151, 19.433],
            [-99.153, 19.418],
            [-99.156, 19.400],
            [-99.160, 19.380],
          ],
        ],
      },
      {
        id: 'metro-cdmx-l7',
        name: 'Línea 7 del Metro CDMX (El Rosario — Barranca del Muerto)',
        mode: 'subway',
        subterranean: true,
        ref: 'L7',
        colour: '#f97316',
        lines: [
          [
            [-99.195, 19.474],
            [-99.192, 19.452],
            [-99.191, 19.435],
            [-99.189, 19.420],
            [-99.187, 19.400],
            [-99.188, 19.372],
          ],
        ],
      },
      {
        id: 'metro-cdmx-l9',
        name: 'Línea 9 del Metro CDMX (Tacubaya — Pantitlán)',
        mode: 'subway',
        subterranean: true,
        ref: 'L9',
        colour: '#78350f',
        lines: [
          [
            [-99.187, 19.403],
            [-99.168, 19.404],
            [-99.153, 19.404],
            [-99.133, 19.406],
            [-99.110, 19.406],
            [-99.088, 19.407],
            [-99.072, 19.415],
          ],
        ],
      },
      {
        id: 'mb-cdmx-l1',
        name: 'Metrobús Línea 1 (Corredor Insurgentes)',
        mode: 'bus',
        ref: 'MB1',
        colour: '#dc2626',
        lines: [
          [
            [-99.125, 19.475],
            [-99.142, 19.458],
            [-99.157, 19.438],
            [-99.166, 19.418],
            [-99.172, 19.398],
            [-99.178, 19.375],
          ],
        ],
      },
      {
        id: 'mb-cdmx-l7',
        name: 'Metrobús Línea 7 (Paseo de la Reforma)',
        mode: 'bus',
        ref: 'MB7',
        colour: '#10b981',
        lines: [
          [
            [-99.126, 19.474],
            [-99.135, 19.450],
            [-99.150, 19.435],
            [-99.170, 19.425],
            [-99.195, 19.424],
            [-99.215, 19.428],
          ],
        ],
      },
    ],
  },
};

function haversineM(p1, p2) {
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

function wayLengthM(coords) {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += haversineM(coords[i], coords[i + 1]);
  }
  return len;
}

async function fetchOsm(bbox) {
  const query = `[out:json][timeout:60];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](${bbox.join(',')});
out geom;`;

  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      console.log(`  Connecting to ${ep}...`);
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FixMyTrafficCityBuilder/1.0 (contact@fixmytraffic.app)',
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log(`  ✓ Received ${data.elements?.length || 0} raw elements from ${ep}`);
      return data.elements || [];
    } catch (err) {
      console.warn(`  ✗ Failed on ${ep}:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function buildCity(cityId) {
  const city = CITIES[cityId];
  if (!city) {
    throw new Error(`Unknown city ${cityId}. Available: ${Object.keys(CITIES).join(', ')}`);
  }

  console.log(`\n========================================`);
  console.log(`Building real dataset for ${city.name}, ${city.country} (${cityId})...`);
  console.log(`BBOX: ${city.bbox.join(', ')} | Center: ${city.center.join(', ')}`);

  const elements = await fetchOsm(city.bbox);

  const namesSet = new Set();
  const validWays = [];

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    let hw = el.tags?.highway || 'secondary';
    const isLink = hw.endsWith('_link') ? 1 : 0;
    if (isLink) hw = hw.replace('_link', '');
    if (!ROAD_TYPES.includes(hw)) continue;

    const coords = el.geometry.map((pt) => [
      Math.round(pt.lon * 1e5) / 1e5,
      Math.round(pt.lat * 1e5) / 1e5,
    ]);

    const lengthM = Math.round(wayLengthM(coords));
    if (lengthM < 25) continue; // Skip tiny stubs

    const name = el.tags?.name?.trim() || '';
    if (name) namesSet.add(name);

    const lanes = el.tags?.lanes ? parseInt(el.tags.lanes, 10) || DEFAULT_LANES[hw] : DEFAULT_LANES[hw];
    const speed = el.tags?.maxspeed ? parseInt(el.tags.maxspeed, 10) || 50 : 50;
    const oneway = el.tags?.oneway === 'yes' ? 1 : 0;

    validWays.push({
      id: `w${el.id}`,
      name,
      roadType: hw,
      isLink,
      lanes: Math.min(6, Math.max(1, lanes)),
      speed,
      oneway,
      lengthM,
      coordinates: coords,
    });
  }

  console.log(`  Filtered ${validWays.length} clean street segments.`);

  const names = Array.from(namesSet);
  const nameToIdx = new Map(names.map((n, i) => [n, i]));

  // Build node map
  const nodeMap = new Map();
  const nodes = [];
  const getNodeIdx = (pt) => {
    const key = `${pt[0]},${pt[1]}`;
    if (nodeMap.has(key)) return nodeMap.get(key);
    const idx = nodes.length;
    nodes.push(pt);
    nodeMap.set(key, idx);
    return idx;
  };

  const segments = [];
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

  // Calculate nearby alternatives for traffic redistribution
  console.log('  Computing parallel alternative paths for traffic redistribution...');
  const segmentMidpoints = segments.map((s) => {
    const coords = s[9];
    return coords[Math.floor(coords.length / 2)];
  });

  for (let i = 0; i < segments.length; i++) {
    const midA = segmentMidpoints[i];
    const alts = [];
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

  const dataset = {
    schemaVersion: 1,
    city: {
      id: city.id,
      name: city.name,
      country: city.country,
      center: city.center,
      bbox: city.bbox,
    },
    version: {
      datasetVersion: 1,
      generatedAt: new Date().toISOString(),
      roadNetworkVersion: `osm-${city.id}-v1`,
      dataSources: [
        {
          id: 'osm',
          name: 'OpenStreetMap',
          kind: 'real',
          license: 'ODbL-1.0',
          attribution: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
          retrievedAt: new Date().toISOString(),
          notes: `${city.name} real urban road network, geometries and intersections`,
        },
      ],
    },
    stats: {
      segmentCount: segments.length,
      nodeCount: nodes.length,
      totalKm: Math.round(segments.reduce((acc, s) => acc + s[6], 0) / 1000),
      kmByType: {
        motorway: Math.round(segments.filter((s) => s[2] === 0).reduce((acc, s) => acc + s[6], 0) / 1000),
        trunk: Math.round(segments.filter((s) => s[2] === 1).reduce((acc, s) => acc + s[6], 0) / 1000),
        primary: Math.round(segments.filter((s) => s[2] === 2).reduce((acc, s) => acc + s[6], 0) / 1000),
        secondary: Math.round(segments.filter((s) => s[2] === 3).reduce((acc, s) => acc + s[6], 0) / 1000),
        tertiary: Math.round(segments.filter((s) => s[2] === 4).reduce((acc, s) => acc + s[6], 0) / 1000),
      },
    },
    roadTypes: ROAD_TYPES,
    names,
    nodes,
    segments,
  };

  const transitDataset = {
    schemaVersion: 1,
    cityId: city.id,
    datasetVersion: 1,
    attribution: city.transitAttribution,
    routes: city.transitRoutes,
  };

  const outDir = path.join(process.cwd(), `public/data/cities/${city.id}/v1`);
  await mkdir(outDir, { recursive: true });

  const roadsPath = path.join(outDir, 'roads.json');
  await writeFile(roadsPath, JSON.stringify(dataset));
  console.log(`  ✓ Saved roads to ${roadsPath}`);

  const transitPath = path.join(outDir, 'transit.json');
  await writeFile(transitPath, JSON.stringify(transitDataset, null, 2));
  console.log(`  ✓ Saved transit to ${transitPath}`);

  console.log(`Done! ${city.name}: ${dataset.stats.segmentCount} streets (${dataset.stats.totalKm} km), ${city.transitRoutes.length} transit lines.`);
  return dataset;
}

const target = process.argv[2] || 'all';
if (target === 'all') {
  for (const c of Object.keys(CITIES)) {
    await buildCity(c);
  }
} else {
  await buildCity(target);
}
