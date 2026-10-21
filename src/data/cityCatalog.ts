/**
 * Static catalogue of playable cities. Dynamic stats (network size, congestion)
 * are computed from the loaded dataset; only curated, sourced facts live here.
 */
export interface SourcedFact<T> {
  value: T;
  source: string;
  /** 'real' when taken from a cited source, 'game' when it is a balance value. */
  kind: 'real' | 'game';
}

export interface CityCatalogEntry {
  id: string;
  name: string;
  country: string;
  flag: string;
  badgeCode: string;
  latestDatasetVersion: number;
  population: SourcedFact<number> | null;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  difficultyLabel: string;
  initialBudget: number;
  streetsCount: number;
  kmCount: number;
  transitSummaryKey: string;
  searchTerms: string[];
}

export const CITY_CATALOG: CityCatalogEntry[] = [
  {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    flag: '🇦🇷',
    badgeCode: 'AR',
    latestDatasetVersion: 1,
    population: {
      value: 3_120_612,
      source: 'INDEC, Censo Nacional 2022 (Ciudad Autónoma de Buenos Aires)',
      kind: 'real',
    },
    difficulty: 'easy',
    difficultyLabel: 'Easy',
    initialBudget: 850_000_000,
    streetsCount: 3670,
    kmCount: 481,
    transitSummaryKey: 'city.buenos_aires.transit',
    searchTerms: ['buenos aires', 'argentina', 'caba', 'porteño', 'subte'],
  },
  {
    id: 'santiago',
    name: 'Santiago',
    country: 'Chile',
    flag: '🇨🇱',
    badgeCode: 'CL',
    latestDatasetVersion: 1,
    population: {
      value: 7_112_808,
      source: 'INE Chile, Proyecciones 2024 (Gran Santiago)',
      kind: 'real',
    },
    difficulty: 'normal',
    difficultyLabel: 'Normal',
    initialBudget: 750_000_000,
    streetsCount: 3787,
    kmCount: 630,
    transitSummaryKey: 'city.santiago.transit',
    searchTerms: ['santiago', 'chile', 'scl', 'metro de santiago'],
  },
  {
    id: 'lima',
    name: 'Lima',
    country: 'Perú',
    flag: '🇵🇪',
    badgeCode: 'PE',
    latestDatasetVersion: 2,
    population: {
      value: 9_569_468,
      source: 'INEI, Censos Nacionales 2017 (Provincia de Lima + Callao)',
      kind: 'real',
    },
    difficulty: 'hard',
    difficultyLabel: 'Hard',
    initialBudget: 650_000_000,
    streetsCount: 3044,
    kmCount: 712,
    transitSummaryKey: 'city.lima.transit',
    searchTerms: ['lima', 'peru', 'perú', 'callao', 'metropolitano'],
  },
  {
    id: 'cdmx',
    name: 'Ciudad de México',
    country: 'México',
    flag: '🇲🇽',
    badgeCode: 'MX',
    latestDatasetVersion: 1,
    population: {
      value: 9_209_944,
      source: 'INEGI, Censo de Población y Vivienda 2020 (CDMX)',
      kind: 'real',
    },
    difficulty: 'extreme',
    difficultyLabel: 'Extreme',
    initialBudget: 1_400_000_000,
    streetsCount: 5223,
    kmCount: 1058,
    transitSummaryKey: 'city.cdmx.transit',
    searchTerms: ['cdmx', 'mexico', 'méxico', 'df', 'distrito federal', 'metro cdmx'],
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    flag: '🇪🇸',
    badgeCode: 'ES',
    latestDatasetVersion: 1,
    population: {
      value: 3_332_035,
      source: 'INE, Padrón Municipal 2023',
      kind: 'real',
    },
    difficulty: 'normal',
    difficultyLabel: 'Normal',
    initialBudget: 950_000_000,
    streetsCount: 3948,
    kmCount: 616,
    transitSummaryKey: 'city.madrid.transit',
    searchTerms: ['madrid', 'spain', 'españa', 'metro de madrid', 'emt'],
  },
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    badgeCode: 'US',
    latestDatasetVersion: 1,
    population: {
      value: 8_258_035,
      source: 'US Census Bureau, 2023 Estimate',
      kind: 'real',
    },
    difficulty: 'hard',
    difficultyLabel: 'Hard',
    initialBudget: 1_250_000_000,
    streetsCount: 5176,
    kmCount: 581,
    transitSummaryKey: 'city.new_york.transit',
    searchTerms: ['new york', 'nyc', 'manhattan', 'united states', 'usa', 'mta subway'],
  },
];

const customCities: CityCatalogEntry[] = [];

// Load custom cities from localStorage if available in browser
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem('fmt_custom_cities');
    if (raw) {
      const parsed = JSON.parse(raw) as CityCatalogEntry[];
      if (Array.isArray(parsed)) {
        customCities.push(...parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function registerCustomCity(entry: CityCatalogEntry): void {
  const existingIdx = customCities.findIndex((c) => c.id === entry.id);
  if (existingIdx >= 0) {
    customCities[existingIdx] = entry;
  } else {
    customCities.push(entry);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('fmt_custom_cities', JSON.stringify(customCities));
    } catch {
      // Ignore quota/storage errors
    }
  }
}

export function getAllCities(): CityCatalogEntry[] {
  return [...CITY_CATALOG, ...customCities];
}

export function findCity(id: string): CityCatalogEntry | undefined {
  return getAllCities().find((c) => c.id === id);
}

export function searchCities(query: string): CityCatalogEntry[] {
  const q = query.trim().toLowerCase();
  const all = getAllCities();
  if (!q) return all;
  return all.filter(
    (c) => c.name.toLowerCase().includes(q) || c.searchTerms.some((t) => t.includes(q)),
  );
}

