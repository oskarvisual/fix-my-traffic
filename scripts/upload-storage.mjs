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
  if (!fs.existsSync(localPath)) {
    console.warn(`File not found: ${localPath}, skipping.`);
    return;
  }
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

const CITIES = ['buenos_aires', 'santiago', 'lima', 'cdmx'];

async function run() {
  await ensureBucket();
  for (const c of CITIES) {
    const v = c === 'lima' ? 1 : 1;
    await uploadFile(`${c}/v1/roads.json`, path.join(process.cwd(), `public/data/cities/${c}/v1/roads.json`));
    await uploadFile(`${c}/v1/transit.json`, path.join(process.cwd(), `public/data/cities/${c}/v1/transit.json`));
    if (c === 'lima') {
      // Also upload v2 if present
      const v2Roads = path.join(process.cwd(), 'public/data/cities/lima/v2/roads.json');
      if (fs.existsSync(v2Roads)) {
        await uploadFile('lima/v2/roads.json', v2Roads);
        await uploadFile('lima/v2/transit.json', path.join(process.cwd(), 'public/data/cities/lima/v1/transit.json'));
      }
    }
  }
  console.log('\nAll 4 city datasets uploaded to Supabase Storage successfully!');
}

run().catch((err) => {
  console.error('Storage upload error:', err);
  process.exit(1);
});
