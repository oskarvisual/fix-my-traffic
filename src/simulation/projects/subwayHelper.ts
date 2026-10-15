import type { RoadNetwork } from '../traffic/network';

export interface SubwayStationPoint {
  name: string;
  coordinates: [number, number];
}

export function haversineKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371;
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180;
  const dLng = ((c2[0] - c1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1[1] * Math.PI) / 180) * Math.cos((c2[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateSubwayLengthKm(stations: SubwayStationPoint[]): number {
  if (stations.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    total += haversineKm(stations[i].coordinates, stations[i + 1].coordinates);
  }
  return Math.round(total * 100) / 100;
}

export function findSubwayCatchmentSegments(
  network: RoadNetwork,
  stations: SubwayStationPoint[],
  radiusKm = 0.65,
): number[] {
  if (stations.length === 0) return [];
  const matched = new Set<number>();
  for (let i = 0; i < network.segments.length; i++) {
    const coords = network.segments[i].coordinates;
    const mid = coords[Math.floor(coords.length / 2)] ?? coords[0];
    if (!mid) continue;
    for (const st of stations) {
      if (haversineKm(mid, st.coordinates) <= radiusKm) {
        matched.add(i);
        break;
      }
    }
  }
  return [...matched];
}

export function estimateSubwayCost(lengthKm: number, stationCount: number): number {
  // $38M per km of bored tunnel + $15M per underground station
  const tunnelCost = lengthKm * 38_000_000;
  const stationsCost = stationCount * 15_000_000;
  return Math.max(50_000_000, Math.round((tunnelCost + stationsCost) / 1_000_000) * 1_000_000);
}
