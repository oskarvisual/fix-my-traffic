import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pg = require('/tmp/pg-inst/node_modules/pg');

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'bikxyqtlrorntdblvmzs';
const DB_PASS = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASS || '';
const HOST = process.env.SUPABASE_DB_HOST || 'aws-1-us-west-2.pooler.supabase.com';

async function run() {
  console.log(`Connecting to Supabase at ${HOST}:5432 (session mode)...`);
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

    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/0001_city_datasets.sql'), 'utf-8');
    console.log('Executing migration 0001_city_datasets.sql...');
    await client.query(sql);
    console.log('Migration executed successfully! Tables & policies created.');

    console.log('Inserting Lima into city_datasets and city_dataset_versions...');
    await client.query(`
      INSERT INTO public.city_datasets (city_id, name, country, center, bbox)
      VALUES (
        'lima',
        'Lima',
        'Peru',
        '[-77.0428, -12.0464]'::jsonb,
        '[-12.35, -77.20, -11.75, -76.75]'::jsonb
      )
      ON CONFLICT (city_id) DO UPDATE SET
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        center = EXCLUDED.center,
        bbox = EXCLUDED.bbox;

      INSERT INTO public.city_dataset_versions (city_id, dataset_version, roads_bundle_path, transit_bundle_path, status)
      VALUES (
        'lima',
        1,
        'lima/v1/roads.json',
        'lima/v1/transit.json',
        'published'
      )
      ON CONFLICT (city_id, dataset_version) DO UPDATE SET
        roads_bundle_path = EXCLUDED.roads_bundle_path,
        transit_bundle_path = EXCLUDED.transit_bundle_path,
        status = EXCLUDED.status;
    `);
    console.log('Lima registered successfully in database!');

    // Verify row count
    const res = await client.query('SELECT city_id, name, country FROM public.city_datasets;');
    console.log('Current cities in database:', res.rows);

    await client.end();
    console.log('\nAll done! Database setup is complete.');
  } catch (err) {
    console.error('Error during setup:', err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

run();
