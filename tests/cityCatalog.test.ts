import { describe, expect, it } from 'vitest';
import { CITY_CATALOG, findCity, registerCustomCity, getAllCities, searchCities } from '../src/data/cityCatalog';
import { getCityJurisdiction, registerCustomJurisdiction } from '../src/data/jurisdictionBoundary';

import { createNewGame } from '../src/simulation/game';
import { buildRoadNetwork } from '../src/simulation/traffic/network';
import fs from 'node:fs';
import path from 'node:path';

describe('Multi-City Catalog & Datasets', () => {
  it('contains the 4 requested cities with appropriate difficulty tiers', () => {
    expect(CITY_CATALOG.length).toBe(4);

    const ba = findCity('buenos_aires');
    expect(ba).toBeDefined();
    expect(ba?.difficulty).toBe('easy');
    expect(ba?.initialBudget).toBe(850_000_000);

    const santiago = findCity('santiago');
    expect(santiago).toBeDefined();
    expect(santiago?.difficulty).toBe('normal');
    expect(santiago?.initialBudget).toBe(750_000_000);

    const lima = findCity('lima');
    expect(lima).toBeDefined();
    expect(lima?.difficulty).toBe('hard');
    expect(lima?.initialBudget).toBe(650_000_000);

    const cdmx = findCity('cdmx');
    expect(cdmx).toBeDefined();
    expect(cdmx?.difficulty).toBe('extreme');
    expect(cdmx?.initialBudget).toBe(1_400_000_000);
  });

  it('provides camera bounds, perimeter line, and inverted mask for every city', () => {
    for (const city of CITY_CATALOG) {
      const jur = getCityJurisdiction(city.id);
      expect(jur).toBeDefined();
      expect(jur.cameraBounds).toHaveLength(2);
      expect(jur.perimeterCoords.length).toBeGreaterThan(5);
      expect(jur.invertedMask.geometry.type).toBe('Polygon');
      expect(jur.invertedMask.geometry.coordinates).toHaveLength(2); // Outer world + inner hole
      expect(jur.perimeterLine.geometry.type).toBe('LineString');
    }
  });

  it('has valid roads.json and transit.json on disk for each city with thousands of real streets', () => {
    for (const city of CITY_CATALOG) {
      const v = city.latestDatasetVersion;
      const roadsPath = path.join(process.cwd(), `public/data/cities/${city.id}/v${v}/roads.json`);
      const transitPath = path.join(process.cwd(), `public/data/cities/${city.id}/v${v}/transit.json`);

      expect(fs.existsSync(roadsPath)).toBe(true);
      expect(fs.existsSync(transitPath)).toBe(true);

      const roads = JSON.parse(fs.readFileSync(roadsPath, 'utf8'));
      expect(roads.schemaVersion).toBe(1);
      expect(roads.segments.length).toBeGreaterThan(2000);
      expect(roads.nodes.length).toBeGreaterThan(1000);

      const transit = JSON.parse(fs.readFileSync(transitPath, 'utf8'));
      expect(transit.routes.length).toBeGreaterThanOrEqual(5);

      // Verify road network can be built cleanly
      const network = buildRoadNetwork(roads);
      expect(network.segments.length).toBe(roads.segments.length);

      // Verify createNewGame initializes state with the city's initial budget
      const state = createNewGame(
        {
          cityId: city.id,
          datasetVersion: v,
          trafficProviderId: 'mock',
          seed: 12345,
        },
        { network, baselineDemand: new Array(network.segments.length).fill(600) },
      );

      expect(state.cityId).toBe(city.id);
      expect(state.finance.publicBudget).toBe(city.initialBudget);
      expect(state.projects.length).toBeGreaterThan(0);
      expect(state.projects[0].name).toBeTruthy();
    }
  });

  it('allows registering and discovering custom imported cities dynamically', () => {
    const testCityId = 'test_montevideo';

    registerCustomCity({
      id: testCityId,
      name: 'Montevideo',
      country: 'Uruguay',
      flag: '🇺🇾',
      badgeCode: 'UY',
      latestDatasetVersion: 1,
      population: null,
      difficulty: 'normal',
      difficultyLabel: 'Medio',
      initialBudget: 700_000_000,
      streetsCount: 2400,
      kmCount: 420,
      transitSummaryKey: 'city.montevideo.transit',
      searchTerms: ['montevideo', 'uruguay', testCityId],
    });

    const all = getAllCities();
    expect(all.some((c: any) => c.id === testCityId)).toBe(true);

    const searchMatch = searchCities('montevideo');
    expect(searchMatch.length).toBeGreaterThan(0);
    expect(searchMatch[0].name).toBe('Montevideo');

    registerCustomJurisdiction({
      cityId: testCityId,
      name: 'Montevideo',
      cameraBounds: [[-56.3, -34.95], [-56.1, -34.8]],
      minZoom: 11.0,
      perimeterCoords: [[-56.2, -34.9], [-56.15, -34.85]],
      invertedMask: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [] },
      },
      perimeterLine: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      },
    });

    const jur = getCityJurisdiction(testCityId);
    expect(jur.name).toBe('Montevideo');
  });
});

