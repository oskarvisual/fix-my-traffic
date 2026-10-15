import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'bikxyqtlrorntdblvmzs';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/storage/v1`;

async function ensureBucket() {
  console.log('Ensuring city-datasets bucket exists...');
  const res = await fetch(`${BASE_URL}/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'city-datasets',
      name: 'city-datasets',
      public: true,
    }),
  });
  console.log('Create bucket status:', res.status, res.statusText);
}

async function uploadFile(remotePath, localPath) {
  console.log(`Uploading ${localPath} -> ${remotePath}...`);
  const content = fs.readFileSync(localPath);
  const res = await fetch(`${BASE_URL}/object/city-datasets/${remotePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: content,
  });
  console.log(`Uploaded ${remotePath}: status ${res.status} ${res.statusText}`);
}

async function run() {
  await ensureBucket();
  await uploadFile('lima/v1/roads.json', path.join(process.cwd(), 'public/data/cities/lima/v1/roads.json'));
  await uploadFile('lima/v1/transit.json', path.join(process.cwd(), 'public/data/cities/lima/v1/transit.json'));
  console.log('Storage upload complete!');
}

run();
