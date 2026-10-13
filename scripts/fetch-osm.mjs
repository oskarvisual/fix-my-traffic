#!/usr/bin/env node
// Downloads raw OpenStreetMap data for a city from public Overpass API mirrors.
// Output is cached under data-raw/ (git-ignored) and later normalized by
// scripts/build-city-dataset.mjs. Data © OpenStreetMap contributors, ODbL 1.0.
//
// Usage: node scripts/fetch-osm.mjs lima
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cityId = process.argv[2] ?? 'lima';
const cities = JSON.parse(readFileSync(join(root, 'scripts', 'cities.json'), 'utf8'));
const city = cities[cityId];
if (!city) throw new Error(`Unknown city "${cityId}". Add it to scripts/cities.json.`);

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const TILES = 3; // split bbox into TILES x TILES requests to stay under server limits
const [south, west, north, east] = city.bbox;

const roadQuery = (bbox) => `[out:json][timeout:180];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary)$"](${bbox});
out body;
>;
out skel qt;`;
const transitQuery = `[out:json][timeout:180];
(
  relation["route"~"^(subway|light_rail|monorail|train)$"](${south},${west},${north},${east});
  relation["route"="bus"]["name"~"Metropolitano|Corredor",i](${south},${west},${north},${east});
);
out geom;`;

async function runQuery(query) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'fix-my-traffic-dataset-builder/0.1 (open-source game prototype)',
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(200_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
        return json;
      } catch (error) {
        lastError = error;
        console.warn(`  ${endpoint} failed: ${error.message}`);
      }
    }
  }
  throw lastError;
}

const outDir = join(root, 'data-raw', cityId);
await mkdir(outDir, { recursive: true });

console.log(`Fetching roads for ${city.name} in ${TILES * TILES} tiles...`);
const elements = new Map();
const dLat = (north - south) / TILES;
const dLon = (east - west) / TILES;
for (let r = 0; r < TILES; r++) {
  for (let c = 0; c < TILES; c++) {
    const bbox = [south + r * dLat, west + c * dLon, south + (r + 1) * dLat, west + (c + 1) * dLon]
      .map((n) => n.toFixed(5))
      .join(',');
    const json = await runQuery(roadQuery(bbox));
    for (const el of json.elements) elements.set(`${el.type}/${el.id}`, el);
    console.log(`  tile ${r * TILES + c + 1}/${TILES * TILES}: ${json.elements.length} elements`);
  }
}
await writeFile(join(outDir, 'roads.json'), JSON.stringify({ elements: [...elements.values()] }));
console.log(`  saved ${elements.size} unique elements`);

console.log('Fetching transit routes...');
try {
  const transit = await runQuery(transitQuery);
  await writeFile(join(outDir, 'transit.json'), JSON.stringify(transit));
  console.log(`  saved ${transit.elements.length} relations`);
} catch (error) {
  console.warn(`Transit fetch failed (optional): ${error.message}`);
}

await writeFile(
  join(outDir, 'meta.json'),
  JSON.stringify({ fetchedAt: new Date().toISOString(), bbox: city.bbox, endpoints: ENDPOINTS }, null, 2),
);
console.log('Done.');
