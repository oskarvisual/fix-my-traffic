export type RoadType = 'arterial' | 'avenue' | 'collector';

export interface RoadSegment {
  id: string;
  name: string;
  coordinates: [number, number][];
  roadType: RoadType;
  lanes: number;
  lengthKm: number;
  speedLimitKph: number;
  baselineDemand: number;
  baseCapacity: number;
  demandModifier: number;
  capacityModifier: number;
  congestion: number;
  adjacentIds: string[];
}

export type ProjectStatus = 'construction' | 'complete';

export interface BikeLaneProject {
  id: string;
  type: 'bike-lane';
  roadId: string;
  roadName: string;
  status: ProjectStatus;
  startedMonth: number;
  completesMonth: number;
  cost: number;
  disruption: number;
  demandReduction: number;
}

export interface GameState {
  cityId: 'lima';
  month: number;
  publicBudget: number;
  personalBalance: number;
  approval: number;
  roads: RoadSegment[];
  projects: BikeLaneProject[];
  selectedRoadId?: string;
  events: GameEvent[];
}

export interface GameEvent {
  id: string;
  month: number;
  tone: 'info' | 'warning' | 'success';
  message: string;
}

export interface BikeLanePreview {
  cost: number;
  durationMonths: number;
  disruption: number;
  predictedCongestionDelta: number;
}
