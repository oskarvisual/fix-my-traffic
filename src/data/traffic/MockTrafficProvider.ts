/**
 * Generates believable but SIMULATED peak-hour demand. Heuristics:
 *   - road class base saturation
 *   - proximity to activity hotspots (Gaussian falloff)
 *   - well-known chronically congested corridors (by street name)
 *   - deterministic per-street and per-segment noise from a seed
 * Output is always flagged `isSimulated: true`.
 */
import type { RoadType } from '../../config/traffic';
import { randomFor } from '../../simulation/random';
import type { RoadNetwork } from '../../simulation/traffic/network';
import type { LngLat } from '../cityDataset';
import type { TrafficDataProvider, TrafficSnapshot } from './TrafficDataProvider';

export interface MockCityProfile {
  hotspots: { center: LngLat; sigmaKm: number; boost: number }[];
  /** Normalised (lowercase, no accents) name fragments of known congested corridors. */
  corridorPatterns: string[];
  corridorBoost: number;
}

const BASE_VC: Record<RoadType, number> = {
  motorway: 0.82,
  trunk: 0.86,
  primary: 0.8,
  secondary: 0.66,
  tertiary: 0.5,
};
const LINK_VC = 0.65;

export const MOCK_PROFILES: Record<string, MockCityProfile> = {
  lima: {
    hotspots: [
      { center: [-77.035, -12.095], sigmaKm: 4.5, boost: 0.32 }, // San Isidro business district
      { center: [-77.03, -12.052], sigmaKm: 3, boost: 0.22 }, // Historic centre
      { center: [-77.03, -12.12], sigmaKm: 2.5, boost: 0.15 }, // Miraflores
      { center: [-77.013, -12.066], sigmaKm: 2, boost: 0.18 }, // Gamarra / La Victoria
      { center: [-76.975, -12.085], sigmaKm: 3, boost: 0.12 }, // Surco / La Molina access
      { center: [-77.06, -12.0], sigmaKm: 3.5, boost: 0.1 }, // Lima Norte access
    ],
    corridorPatterns: [
      'javier prado',
      'panamericana',
      'expresa',
      'paseo de la republica',
      'evitamiento',
      'abancay',
      'arequipa',
      'brasil',
      'la marina',
      'faucett',
      'tupac amaru',
      'universitaria',
      'angamos',
      'benavides',
      'aviacion',
      'grau',
      'primavera',
      'priale',
      'nicolas ayllon',
      'carretera central',
      'alfonso ugarte',
      'canada',
      'mexico',
      'colonial',
      'venezuela',
      'argentina',
      'naranjal',
      'izaguirre',
      'separadora industrial',
      'los heroes',
      'proceres',
    ],
    corridorBoost: 1.17,
  },
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function distanceKm(a: LngLat, b: LngLat): number {
  const kx = 111.32 * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110.54);
}

export function generateMockBaseline(network: RoadNetwork, profile: MockCityProfile, seed: number): number[] {
  return network.segments.map((seg) => {
    const mid = seg.coordinates[Math.floor(seg.coordinates.length / 2)];
    let vc = seg.isLink ? LINK_VC : BASE_VC[seg.roadType];
    let centrality = 0;
    for (const h of profile.hotspots) {
      const d = distanceKm(mid, h.center);
      centrality += h.boost * Math.exp(-(d * d) / (2 * h.sigmaKm * h.sigmaKm));
    }
    vc *= 1 + Math.min(0.45, centrality);
    const name = normalize(seg.name);
    if (name && profile.corridorPatterns.some((p) => name.includes(p))) vc *= profile.corridorBoost;
    const streetKey = name || String(seg.id).split('-')[0];
    vc *= 0.88 + 0.24 * randomFor(seed, `street:${streetKey}`);
    vc *= 0.94 + 0.12 * randomFor(seed, `seg:${String(seg.id)}`);
    return Math.round(vc * seg.baseCapacity);
  });
}

export class MockTrafficProvider implements TrafficDataProvider {
  readonly id = 'mock-heuristic-v1';

  constructor(
    private readonly network: RoadNetwork,
    private readonly seed: number,
  ) {}

  async getTrafficData(cityId: string): Promise<TrafficSnapshot> {
    const profile = MOCK_PROFILES[cityId] ?? { hotspots: [], corridorPatterns: [], corridorBoost: 1 };
    return {
      cityId,
      datasetVersion: this.network.datasetVersion,
      providerId: this.id,
      isSimulated: true,
      baselineDemandVph: generateMockBaseline(this.network, profile, this.seed),
      provenance: {
        id: this.id,
        name: 'Fix My Traffic mock traffic model',
        kind: 'simulated',
        license: 'n/a',
        attribution: 'Simulated game data — not real traffic',
        url: '',
        retrievedAt: 'generated',
        notes: `Heuristic estimate, seed ${this.seed}`,
      },
    };
  }
}
