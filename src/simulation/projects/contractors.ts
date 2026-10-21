/**
 * Contractor bidding system with procurement pros, cons, and corruption kickbacks.
 */
import type { ProjectTypeId } from '../../config/projects';

export interface ContractorBid {
  id: string;
  name: string;
  country: string;
  reputation: 'excellent' | 'questionable' | 'corrupt';
  headline: string;
  pros: string[];
  cons: string[];
  costMultiplier: number;
  durationMultiplier: number;
  delayRisk: number; // 0..1 probability of delays
  /** Kickback / bribe offered to the minister's personal account. */
  bribeOffer: number;
  /** Increase in corruption suspicion index (0..1). */
  corruptionRisk: number;
}

export function generateContractorBids(
  typeId: ProjectTypeId,
  baseCost: number,
  _baseDurationDays: number,
  seed: number,
): ContractorBid[] {
  // 1. Honest Technical Consortium
  const techBid: ContractorBid = {
    id: `bid-tech-${seed}`,
    name: 'Andean Consortium - Hochtief Infra',
    country: 'Germany / International',
    reputation: 'excellent',
    headline: 'High technical solvency, ISO quality certification, and zero contract disputes.',
    pros: [
      'European engineering standards & quality guarantee',
      'Strict adherence to deadlines without cost overruns',
      '100% clean audit and transparency record',
    ],
    cons: [
      'Cost is 8% higher than base procurement estimate',
      'Requires prompt treasury payments without fiscal delays',
    ],
    costMultiplier: 1.08,
    durationMultiplier: 1.0,
    delayRisk: 0.05,
    bribeOffer: 0,
    corruptionRisk: 0,
  };

  // 2. Low-Cost / Risky Builder
  const lowBid: ContractorBid = {
    id: `bid-low-${seed}`,
    name: 'FastLane Construction & Associates',
    country: 'Domestic Private',
    reputation: 'questionable',
    headline: 'Aggressive budget discounts, but history of project delays and cost addenda.',
    pros: [
      'Immediate 16% public budget savings',
      'Expedited mobilization with local equipment and crews',
    ],
    cons: [
      'High risk of work stoppages and contractor arbitration',
      'History of demanding budget addenda for unforeseen issues (+8% audit risk)',
    ],
    costMultiplier: 0.84,
    durationMultiplier: 1.15,
    delayRisk: 0.40,
    bribeOffer: 0,
    corruptionRisk: 0.08,
  };

  // 3. Corrupt Mega-Contractor ("El Club de la Construcción")
  const bribeAmount = Math.max(
    15_000,
    Math.round((baseCost * 0.055) / 5000) * 5000,
  );
  const corruptBid: ContractorBid = {
    id: `bid-corrupt-${seed}`,
    name: 'Pacific Mega-Infrastructure S.A.',
    country: 'Private Cartel',
    reputation: 'corrupt',
    headline: 'Fast political delivery with an upfront "confidential ministerial contribution".',
    pros: [
      'Heavy political lobbying and expedited municipal permits',
      'Flexible private bridge-financing for immediate ground-breaking',
    ],
    cons: [
      '14% inflated materials cost surcharge',
      'Private kickback offered: high risk of investigative press leaks',
      'Immediate Comptroller scrutiny if scandal is exposed',
    ],
    costMultiplier: 1.14,
    durationMultiplier: 0.95,
    delayRisk: 0.20,
    bribeOffer: bribeAmount,
    corruptionRisk: typeId === 'subway' || typeId === 'elevatedMetro' ? 0.35 : 0.22,
  };

  return [techBid, lowBid, corruptBid];
}
