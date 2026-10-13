# Fix My Traffic

Local-first traffic-management simulation built with React, TypeScript and Vite.

## Run locally

Use Node.js 22.12.0 or newer (the repository includes `.nvmrc`) and pnpm:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

City data ships under `public/data`. Supabase configuration is optional; copy
`.env.example` to `.env.local` only when you want to load a shared city dataset.
