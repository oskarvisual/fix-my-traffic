import { balance } from '../simulation/config';

export const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const gameDate = (month: number) => `Year ${Math.floor(month / 12) + 1} · Month ${(month % 12) + 1}`;
export function congestionColor(score: number): string {
  if (score < balance.congestion.freeFlow) return '#3fbd86';
  if (score < balance.congestion.moderate) return '#e8cb55';
  if (score < balance.congestion.heavy) return '#f08b45';
  if (score < balance.congestion.severe) return '#ed5555';
  return '#7d1d32';
}
export const congestionLabel = (score: number) => score < .35 ? 'Free flowing' : score < .55 ? 'Moderate' : score < .75 ? 'Heavy' : score < .9 ? 'Severe' : 'Extreme';
