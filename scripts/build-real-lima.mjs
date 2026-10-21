import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// Expanded metropolitan zone of Lima (~16km x 18km):
// Covers Callao, Aeropuerto, Los Olivos, SJL, Ate, La Molina, San Borja, Miraflores, Surco, Chorrillos
const BBOX = [-12.180, -77.140, -11.950, -76.920]; // [south, west, north, east]
const CENTER = [-77.035, -12.09];

const QUERY = `[out:json][timeout:90];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](${BBOX.join(',')});
out geom;`;

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const ROAD_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const DEFAULT_LANES = {
  motorway: 4,
  trunk: 3,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

async function fetchOsm() {
  console.log('Fetching real road network from Overpass mirror...');
  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      console.log(`Trying ${ep}...`);
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'fix-my-traffic-builder/1.0',
        },
        body: 'data=' + encodeURIComponent(QUERY),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log(`Success on ${ep}! Received ${data.elements.length} real road elements.`);
      return data.elements;
    } catch (err) {
      console.warn(`  Failed on ${ep}:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr;
}

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

export async function buildDataset() {
  const elements = await fetchOsm();

  const namesSet = new Set();
  const validWays = [];

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    let hw = el.tags.highway || 'secondary';
    const isLink = hw.endsWith('_link') ? 1 : 0;
    if (isLink) hw = hw.replace('_link', '');
    if (!ROAD_TYPES.includes(hw)) continue;

    const coords = el.geometry.map((pt) => [
      Math.round(pt.lon * 1e5) / 1e5,
      Math.round(pt.lat * 1e5) / 1e5,
    ]);

    const lengthM = Math.round(wayLengthM(coords));
    if (lengthM < 25) continue; // Skip tiny stubs

    const name = el.tags.name?.trim() || '';
    if (name) namesSet.add(name);

    const lanes = el.tags.lanes ? parseInt(el.tags.lanes, 10) || DEFAULT_LANES[hw] : DEFAULT_LANES[hw];
    const speed = el.tags.maxspeed ? parseInt(el.tags.maxspeed, 10) || 50 : 50;
    const oneway = el.tags.oneway === 'yes' ? 1 : 0;

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

  console.log(`Processed ${validWays.length} valid street segments.`);

  const names = Array.from(namesSet);
  const nameToIdx = new Map(names.map((n, i) => [n, i]));

  // Build nodes map
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
  console.log('Calculating parallel alternatives for network redistribution...');
  const segmentMidpoints = segments.map((s) => {
    const coords = s[9];
    const mid = coords[Math.floor(coords.length / 2)];
    return mid;
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
      id: 'lima',
      name: 'Lima',
      country: 'Peru',
      center: CENTER,
      bbox: BBOX,
    },
    version: {
      datasetVersion: 2,
      generatedAt: new Date().toISOString(),
      roadNetworkVersion: 'osm-lima-central-core-v2',
      dataSources: [
        {
          id: 'osm',
          name: 'OpenStreetMap',
          kind: 'real',
          license: 'ODbL-1.0',
          attribution: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
          retrievedAt: new Date().toISOString(),
          notes: 'Lima central core playable district: real road trajectories and intersections',
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

  const outPath1 = path.join(process.cwd(), 'public/data/cities/lima/v1/roads.json');
  const outPath2 = path.join(process.cwd(), 'public/data/cities/lima/v2/roads.json');
  await writeFile(outPath1, JSON.stringify(dataset));
  await writeFile(outPath2, JSON.stringify(dataset));
  console.log(`Saved real Lima street dataset to ${outPath1} and ${outPath2}!`);
  console.log(`Stats: ${dataset.stats.segmentCount} streets, ${dataset.stats.totalKm} km, ${names.length} named avenues.`);
}

buildDataset().catch((err) => {
  console.error('Build dataset error:', err);
  process.exit(1);
});
