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
    name: 'Consorcio Andino - Hochtief Infra',
    country: 'Alemania / Perú',
    reputation: 'excellent',
    headline: 'Máxima solvencia técnica internacional y cero disputas.',
    pros: [
      'Garantía de calidad de estándares europeos',
      'Cumplimiento estricto de plazos sin adendas',
      'Auditoría y transparencia 100% limpia',
    ],
    cons: [
      'Costo un 8% superior al presupuesto base',
      'Exige pago puntual y sin retrasos de tesorería',
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
    name: 'Constructora Vías Rápidas & Asociados',
    country: 'Perú',
    reputation: 'questionable',
    headline: 'Presupuesto económico y agresivo, pero historial de retrasos.',
    pros: [
      'Ahorro inmediato del 16% del presupuesto público',
      'Inicio de obras expedito con maquinaria local',
    ],
    cons: [
      'Alto riesgo de paralizaciones y arbitrajes',
      'Historial de exigir adendas por imprevistos técnicos (+8% riesgo de auditoría)',
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
    name: 'Inversiones & Obras del Pacífico S.A.',
    country: 'Consorcio Privado',
    reputation: 'corrupt',
    headline: 'Garantizan entrega política rápida y ofrecen un "aporte reservado".',
    pros: [
      'Capacidad de lobby y agilización de trámites burocráticos',
      'Financiamiento flexible de inicio de obra',
    ],
    cons: [
      'Sobreprecio inflado en materiales del 14%',
      'Ofrecen coima privada: alto riesgo de filtración en la prensa',
      'Alerta inmediata en la Contraloría si se destapa el escándalo',
    ],
    costMultiplier: 1.14,
    durationMultiplier: 0.95,
    delayRisk: 0.20,
    bribeOffer: bribeAmount,
    corruptionRisk: typeId === 'subway' || typeId === 'elevatedMetro' ? 0.35 : 0.22,
  };

  return [techBid, lowBid, corruptBid];
}
