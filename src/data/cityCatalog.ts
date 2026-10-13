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
  latestDatasetVersion: number;
  population: SourcedFact<number> | null;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  /** i18n key with a short description of the public transport system. */
  transitSummaryKey: string;
  searchTerms: string[];
}

export const CITY_CATALOG: CityCatalogEntry[] = [
  {
    id: 'lima',
    name: 'Lima',
    country: 'Peru',
    latestDatasetVersion: 1,
    population: {
      value: 9_569_468,
      source: 'INEI, Censos Nacionales 2017 (Lima Province + Constitutional Province of Callao)',
      kind: 'real',
    },
    difficulty: 'hard',
    transitSummaryKey: 'city.lima.transit',
    searchTerms: ['lima', 'peru', 'perú', 'callao'],
  },
];

export function findCity(id: string): CityCatalogEntry | undefined {
  return CITY_CATALOG.find((c) => c.id === id);
}

export function searchCities(query: string): CityCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITY_CATALOG;
  return CITY_CATALOG.filter(
    (c) => c.name.toLowerCase().includes(q) || c.searchTerms.some((t) => t.includes(q)),
  );
}
