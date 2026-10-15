-- City datasets migration for Fix My Traffic
CREATE TABLE IF NOT EXISTS public.city_datasets (
  city_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  center JSONB NOT NULL,
  bbox JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.city_dataset_versions (
  id BIGSERIAL PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES public.city_datasets(city_id) ON DELETE CASCADE,
  dataset_version INT NOT NULL,
  roads_bundle_path TEXT NOT NULL,
  transit_bundle_path TEXT,
  traffic_baseline_path TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  data_sources JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_id, dataset_version)
);

-- Enable Row Level Security (RLS) but allow public read for everyone
ALTER TABLE public.city_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_dataset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on city_datasets"
  ON public.city_datasets FOR SELECT USING (true);

CREATE POLICY "Allow public read on city_dataset_versions"
  ON public.city_dataset_versions FOR SELECT USING (true);

-- Allow service role full access (default in Supabase, but explicit)
CREATE POLICY "Allow service role insert on city_datasets"
  ON public.city_datasets FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role insert on city_dataset_versions"
  ON public.city_dataset_versions FOR ALL USING (auth.role() = 'service_role');

-- Create storage bucket if storage extension exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('city-datasets', 'city-datasets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Access to city-datasets bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'city-datasets');

CREATE POLICY "Service Role Upload to city-datasets bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'city-datasets');
