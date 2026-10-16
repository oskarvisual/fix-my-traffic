import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pg = require('/tmp/pg-inst/node_modules/pg');

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'bikxyqtlrorntdblvmzs';
const DB_PASS = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASS || '';
const HOST = process.env.SUPABASE_DB_HOST || 'aws-1-us-west-2.pooler.supabase.com';

const CITIES = [
  {
    city_id: 'buenos_aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    center: [-58.417, -34.603],
    bbox: [-34.650, -58.485, -34.560, -58.355],
    versions: [1],
  },
  {
    city_id: 'santiago',
    name: 'Santiago',
    country: 'Chile',
    center: [-70.650, -33.445],
    bbox: [-33.485, -70.720, -33.405, -70.580],
    versions: [1],
  },
  {
    city_id: 'lima',
    name: 'Lima',
    country: 'Peru',
    center: [-77.035, -12.090],
    bbox: [-12.135, -77.085, -12.042, -76.995],
    versions: [1, 2],
  },
  {
    city_id: 'cdmx',
    name: 'Ciudad de México',
    country: 'México',
    center: [-99.145, 19.432],
    bbox: [19.370, -99.220, 19.475, -99.080],
    versions: [1],
  },
];

async function run() {
  console.log(`Connecting to Supabase PostgreSQL at ${HOST}:5432...`);
  const client = new pg.Client({
    host: HOST,
    port: 5432,
    user: `postgres.${PROJECT_ID}`,
    password: DB_PASS,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    for (const city of CITIES) {
      console.log(`Registering ${city.name} (${city.city_id})...`);
      await client.query(
        `
        INSERT INTO public.city_datasets (city_id, name, country, center, bbox)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (city_id) DO UPDATE SET
          name = EXCLUDED.name,
          country = EXCLUDED.country,
          center = EXCLUDED.center,
          bbox = EXCLUDED.bbox;
        `,
        [city.city_id, city.name, city.country, JSON.stringify(city.center), JSON.stringify(city.bbox)],
      );

      for (const v of city.versions) {
        await client.query(
          `
          INSERT INTO public.city_dataset_versions (city_id, dataset_version, roads_bundle_path, transit_bundle_path, status)
          VALUES ($1, $2, $3, $4, 'published')
          ON CONFLICT (city_id, dataset_version) DO UPDATE SET
            roads_bundle_path = EXCLUDED.roads_bundle_path,
            transit_bundle_path = EXCLUDED.transit_bundle_path,
            status = EXCLUDED.status;
          `,
          [city.city_id, v, `${city.city_id}/v${v}/roads.json`, `${city.city_id}/v${v}/transit.json`],
        );
      }
    }

    console.log('\nAll cities registered successfully in PostgreSQL!');

    const res = await client.query('SELECT city_id, name, country FROM public.city_datasets ORDER BY city_id;');
    console.log('Registered cities in database:', res.rows);

    const versions = await client.query('SELECT city_id, dataset_version, roads_bundle_path, status FROM public.city_dataset_versions ORDER BY city_id, dataset_version;');
    console.log('Registered versions in database:', versions.rows);

    await client.end();
  } catch (err) {
    console.error('Error during setup:', err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

run();
