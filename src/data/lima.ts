import type { RoadSegment } from '../domain/types';

// Geometry is a deliberately small, simulated subset positioned over Lima. It is not a
// complete road dataset and must never be described as live traffic information.
export const limaRoads: RoadSegment[] = [
  { id: 'javier-prado', name: 'Av. Javier Prado Este', coordinates: [[-77.036, -12.09], [-77.01, -12.092], [-76.982, -12.1]], roadType: 'arterial', lanes: 4, lengthKm: 6.2, speedLimitKph: 50, baselineDemand: 4350, baseCapacity: 4100, demandModifier: 1, capacityModifier: 1, congestion: 0, adjacentIds: ['canada', 'circunvalacion'] },
  { id: 'arequipa', name: 'Av. Arequipa', coordinates: [[-77.036, -12.055], [-77.035, -12.078], [-77.034, -12.105]], roadType: 'avenue', lanes: 3, lengthKm: 5.6, speedLimitKph: 45, baselineDemand: 3000, baseCapacity: 3300, demandModifier: 1, capacityModifier: 1, congestion: 0, adjacentIds: ['canada', 'paseo-republica'] },
  { id: 'paseo-republica', name: 'Vía Expresa Paseo de la República', coordinates: [[-77.032, -12.075], [-77.02, -12.094], [-77.012, -12.115]], roadType: 'arterial', lanes: 4, lengthKm: 6.8, speedLimitKph: 60, baselineDemand: 4300, baseCapacity: 4050, demandModifier: 1, capacityModifier: 1, congestion: 0, adjacentIds: ['javier-prado', 'arequipa', 'circunvalacion'] },
  { id: 'canada', name: 'Av. Canadá', coordinates: [[-77.051, -12.085], [-77.028, -12.086], [-77.004, -12.087]], roadType: 'avenue', lanes: 3, lengthKm: 5, speedLimitKph: 45, baselineDemand: 3200, baseCapacity: 3200, demandModifier: 1, capacityModifier: 1, congestion: 0, adjacentIds: ['javier-prado', 'arequipa'] },
  { id: 'circunvalacion', name: 'Vía de Evitamiento', coordinates: [[-77.005, -12.075], [-76.992, -12.095], [-76.98, -12.12]], roadType: 'arterial', lanes: 4, lengthKm: 7, speedLimitKph: 65, baselineDemand: 4000, baseCapacity: 4300, demandModifier: 1, capacityModifier: 1, congestion: 0, adjacentIds: ['javier-prado', 'paseo-republica'] },
];
