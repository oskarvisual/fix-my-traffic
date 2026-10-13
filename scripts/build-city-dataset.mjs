#!/usr/bin/env node
// Normalizes raw Overpass output (data-raw/<city>/) into a versioned, compact city
// dataset consumed by the game (public/data/cities/<city>/v<version>/).
//
// Pipeline: OSM ways -> split at intersections -> merge into ~MIN_SEGMENT_M segments
// -> simplify geometry -> road graph (node ids) -> parallel alternatives + twins.
//
// Usage: node scripts/build-city-dataset.mjs lima [--version 1]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cityId = process.argv[2] ?? 'lima';
const versionArg = process.argv.indexOf('--version');
const datasetVersion = versionArg > 0 ? Number(process.argv[versionArg + 1]) : 1;

const cities = JSON.parse(await readFile(join(root, 'scripts', 'cities.json'), 'utf8'));
const city = cities[cityId];
const rawDir = join(root, 'data-raw', cityId);
const raw = JSON.parse(await readFile(join(rawDir, 'roads.json'), 'utf8'));
const rawMeta = JSON.parse(await readFile(join(rawDir, 'meta.json'), 'utf8'));

// ---- Tunables (pipeline only; gameplay coefficients live in src/config) ----
const INCLUDED_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const MIN_SEGMENT_M = 350;
const MAX_SEGMENT_M = 1200;
const MIN_ISOLATED_WAY_M = 120; // drop tiny fragments not touching anything
const SIMPLIFY_TOLERANCE_M = 4;
const ALT_RADIUS_M = 1500;
const ALT_MAX = 6;
const ALT_MAX_BEARING_DIFF = 35;
const TWIN_RADIUS_M = 90;
const DEFAULT_LANES = { motorway: 3, trunk: 3, primary: 2, secondary: 2, tertiary: 1 };
const DEFAULT_SPEED = { motorway: 80, trunk: 60, primary: 50, secondary: 40, tertiary: 35 };

// ---- Geo helpers (equirectangular projection around the city center) ----
const [cLon, cLat] = city.center;
const KX = 111320 * Math.cos((cLat * Math.PI) / 180);
const KY = 110540;
const toXY = ([lon, lat]) => [(lon - cLon) * KX, (lat - cLat) * KY];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round5 = (n) => Math.round(n * 1e5) / 1e5;

function simplify(points, tol) {
  if (points.length <= 2) return points;
  const xy = points.map(toXY);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = xy[s];
    const [x2, y2] = xy[e];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((x2 - x1) * (y1 - xy[i][1]) - (x1 - xy[i][0]) * (y2 - y1)) / len;
      if (d > maxD) [maxD, idx] = [d, i];
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function bearing(a, b) {
  const deg = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return (deg + 180) % 180; // undirected, 0..180
}
const bearingDiff = (a, b) => {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
};
const normalizeName = (name) =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(avenida|av\.?|jiron|jr\.?|calle|via)\s+/, '')
    .trim();

// ---- Parse OSM ----
const nodeCoord = new Map();
const ways = [];
for (const el of raw.elements) {
  if (el.type === 'node') nodeCoord.set(el.id, [el.lon, el.lat]);
  else if (el.type === 'way') ways.push(el);
}
const usableWays = ways
  .map((w) => {
    const hw = w.tags?.highway ?? '';
    const baseType = hw.replace('_link', '');
    return { ...w, roadType: baseType, isLink: hw.endsWith('_link') };
  })
  .filter((w) => INCLUDED_TYPES.includes(w.roadType) && !(w.isLink && w.roadType === 'tertiary'))
  .filter((w) => w.nodes.every((n) => nodeCoord.has(n)));

const nodeUse = new Map();
for (const w of usableWays) for (const n of w.nodes) nodeUse.set(n, (nodeUse.get(n) ?? 0) + 1);

function parseLanes(w) {
  const tags = w.tags ?? {};
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || w.roadType === 'motorway' || tags.junction === 'roundabout';
  let lanes = Number.parseInt(tags.lanes ?? '', 10);
  if (!Number.isFinite(lanes) || lanes <= 0 || lanes > 10) {
    lanes = DEFAULT_LANES[w.roadType] * (oneway ? 1 : 2);
    if (w.isLink) lanes = 1;
  }
  return { lanes, oneway };
}
function parseSpeed(w) {
  const v = Number.parseInt(w.tags?.maxspeed ?? '', 10);
  return Number.isFinite(v) && v > 0 && v < 130 ? v : DEFAULT_SPEED[w.roadType];
}

// ---- Split ways into segments ----
const segments = [];
for (const w of usableWays) {
  const { lanes, oneway } = parseLanes(w);
  const speed = parseSpeed(w);
  const name = w.tags?.name ?? w.tags?.ref ?? '';
  let start = 0;
  let acc = 0;
  const totalLen = w.nodes.reduce(
    (s, n, i) => (i ? s + dist(toXY(nodeCoord.get(w.nodes[i - 1])), toXY(nodeCoord.get(n))) : 0),
    0,
  );
  const touches = w.nodes.some((n) => nodeUse.get(n) > 1);
  if (!touches && totalLen < MIN_ISOLATED_WAY_M) continue;
  let part = 0;
  for (let i = 1; i < w.nodes.length; i++) {
    acc += dist(toXY(nodeCoord.get(w.nodes[i - 1])), toXY(nodeCoord.get(w.nodes[i])));
    const last = i === w.nodes.length - 1;
    const atIntersection = nodeUse.get(w.nodes[i]) > 1;
    const remaining = totalLen - acc;
    const cut =
      last ||
      acc >= MAX_SEGMENT_M ||
      (atIntersection && acc >= MIN_SEGMENT_M && remaining >= MIN_SEGMENT_M * 0.5);
    if (!cut) continue;
    const nodeIds = w.nodes.slice(start, i + 1);
    segments.push({
      id: `w${w.id}-${part++}`,
      wayId: w.id,
      name,
      roadType: w.roadType,
      isLink: w.isLink,
      lanes,
      oneway,
      speed,
      length: Math.round(acc),
      fromNode: nodeIds[0],
      toNode: nodeIds[nodeIds.length - 1],
      coords: simplify(nodeIds.map((n) => nodeCoord.get(n)), SIMPLIFY_TOLERANCE_M).map(([x, y]) => [
        round5(x),
        round5(y),
      ]),
    });
    start = i;
    acc = 0;
  }
}

// ---- Graph nodes ----
const nodeIndex = new Map();
const nodes = [];
for (const s of segments) {
  for (const n of [s.fromNode, s.toNode]) {
    if (!nodeIndex.has(n)) {
      nodeIndex.set(n, nodes.length);
      const [lon, lat] = nodeCoord.get(n);
      nodes.push([round5(lon), round5(lat)]);
    }
  }
}

// ---- Spatial grid for alternatives / twins ----
const mids = segments.map((s) => toXY(s.coords[Math.floor(s.coords.length / 2)]));
const bearings = segments.map((s) => bearing(toXY(s.coords[0]), toXY(s.coords[s.coords.length - 1])));
const names = segments.map((s) => normalizeName(s.name));
const CELL = ALT_RADIUS_M;
const grid = new Map();
const key = (x, y) => `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;
mids.forEach((m, i) => {
  const k = key(m[0], m[1]);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(i);
});
function nearby(i, radius) {
  const [x, y] = mids[i];
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const out = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
        if (j === i) continue;
        const d = dist(mids[i], mids[j]);
        if (d <= radius) out.push([j, d]);
      }
  return out;
}

const alternatives = [];
const twins = [];
segments.forEach((s, i) => {
  const near = nearby(i, ALT_RADIUS_M);
  const parallel = near.filter(([j]) => bearingDiff(bearings[i], bearings[j]) <= ALT_MAX_BEARING_DIFF && !segments[j].isLink);
  twins.push(
    parallel
      .filter(([j, d]) => d <= TWIN_RADIUS_M && names[i] && names[i] === names[j])
      .map(([j]) => j),
  );
  const alts = parallel
    .filter(([j]) => !names[i] || names[i] !== names[j])
    .filter(([j]) => segments[j].roadType !== 'tertiary' || s.roadType === 'tertiary' || s.roadType === 'secondary')
    .sort((a, b) => a[1] - b[1])
    .slice(0, ALT_MAX)
    .map(([j, d]) => [j, Math.round(1000 / (d / 100 + 1)) / 1000]);
  alternatives.push(alts);
});

// ---- Output ----
const TYPE_CODES = INCLUDED_TYPES;
const nameTable = [];
const nameIdx = new Map();
const nameRef = (n) => {
  if (!nameIdx.has(n)) {
    nameIdx.set(n, nameTable.length);
    nameTable.push(n);
  }
  return nameIdx.get(n);
};
const totalKm = segments.reduce((s, x) => s + x.length, 0) / 1000;
const byType = Object.fromEntries(TYPE_CODES.map((t) => [t, 0]));
segments.forEach((s) => (byType[s.roadType] += s.length / 1000));

const dataset = {
  schemaVersion: 1,
  city: {
    id: cityId,
    name: city.name,
    country: city.country,
    center: city.center,
    bbox: city.bbox,
  },
  version: {
    datasetVersion,
    generatedAt: new Date().toISOString(),
    roadNetworkVersion: `osm-overpass-${rawMeta.fetchedAt.slice(0, 10)}`,
    dataSources: [
      {
        id: 'osm',
        name: 'OpenStreetMap',
        kind: 'real',
        license: 'ODbL-1.0',
        attribution: '© OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
        retrievedAt: rawMeta.fetchedAt,
        notes: `Overpass API, highway in (${INCLUDED_TYPES.join(', ')})`,
      },
    ],
  },
  stats: {
    segmentCount: segments.length,
    nodeCount: nodes.length,
    totalKm: Math.round(totalKm),
    kmByType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v)])),
  },
  roadTypes: TYPE_CODES,
  names: nameTable,
  nodes,
  // Tuple layout documented in src/data/cityDataset.ts (DatasetSegmentTuple)
  segments: segments.map((s, i) => [
    s.id,
    nameRef(s.name),
    TYPE_CODES.indexOf(s.roadType),
    s.lanes,
    s.speed,
    s.oneway ? 1 : 0,
    s.length,
    nodeIndex.get(s.fromNode),
    nodeIndex.get(s.toNode),
    s.coords,
    alternatives[i],
    twins[i],
    s.isLink ? 1 : 0,
  ]),
};

// ---- Transit (existing routes, display only) ----
let transitRoutes = [];
try {
  const transitRaw = JSON.parse(await readFile(join(rawDir, 'transit.json'), 'utf8'));
  transitRoutes = transitRaw.elements
    .filter((el) => el.type === 'relation')
    .map((rel) => ({
      id: `r${rel.id}`,
      name: rel.tags?.name ?? rel.tags?.ref ?? 'Transit route',
      mode: rel.tags?.route,
      ref: rel.tags?.ref ?? null,
      colour: rel.tags?.colour ?? null,
      lines: rel.members
        .filter((m) => m.type === 'way' && Array.isArray(m.geometry))
        .map((m) => simplify(m.geometry.map((g) => [g.lon, g.lat]), 8).map(([x, y]) => [round5(x), round5(y)])),
    }))
    .filter((r) => r.lines.length > 0);
  // Keep a single representative relation per (mode, ref/name) to avoid both directions.
  const seen = new Set();
  transitRoutes = transitRoutes.filter((r) => {
    const k = `${r.mode}:${(r.ref ?? r.name).toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
} catch (error) {
  console.warn('No transit data:', error.message);
}

const outDir = join(root, 'public', 'data', 'cities', cityId, `v${datasetVersion}`);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'roads.json'), JSON.stringify(dataset));
await writeFile(
  join(outDir, 'transit.json'),
  JSON.stringify({ schemaVersion: 1, cityId, datasetVersion, attribution: '© OpenStreetMap contributors', routes: transitRoutes }),
);
console.log(
  `Built ${cityId} v${datasetVersion}: ${segments.length} segments, ${nodes.length} nodes, ${Math.round(totalKm)} km, ${transitRoutes.length} transit routes`,
);
console.log(byType);
