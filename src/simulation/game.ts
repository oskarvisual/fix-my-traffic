import { limaRoads } from '../data/lima';
import type { BikeLanePreview, BikeLaneProject, GameState } from '../domain/types';
import { balance } from './config';
import { recalculateRoads, redistributeTraffic } from './traffic';

export function initialGame(): GameState {
  return { cityId: 'lima', month: 0, publicBudget: balance.startingBudget, personalBalance: 280_000, approval: 51, roads: recalculateRoads(limaRoads), projects: [], events: [{ id: 'welcome', month: 0, tone: 'info', message: 'Lima inherits severe peak-hour congestion. All traffic is simulated.' }] };
}

export function previewBikeLane(): BikeLanePreview {
  return { cost: balance.bikeLane.cost, durationMonths: balance.bikeLane.durationMonths, disruption: balance.bikeLane.constructionCapacityPenalty, predictedCongestionDelta: -0.12 };
}

export function approveBikeLane(state: GameState, roadId: string): GameState {
  const road = state.roads.find((item) => item.id === roadId);
  const preview = previewBikeLane();
  if (!road || state.publicBudget < preview.cost || state.projects.some((project) => project.roadId === roadId && project.status === 'construction')) return state;
  const project: BikeLaneProject = { id: `bike-${roadId}-${state.month}`, type: 'bike-lane', roadId, roadName: road.name, status: 'construction', startedMonth: state.month, completesMonth: state.month + preview.durationMonths, cost: preview.cost, disruption: preview.disruption, demandReduction: balance.bikeLane.completedDemandReduction };
  const affected = state.roads.map((item) => item.id === roadId ? { ...item, capacityModifier: item.capacityModifier * (1 - project.disruption) } : item);
  const roads = redistributeTraffic(affected, roadId, road.baselineDemand * project.disruption);
  return { ...state, publicBudget: state.publicBudget - preview.cost, roads, projects: [...state.projects, project], events: [{ id: `approved-${project.id}`, month: state.month, tone: 'warning', message: `${road.name}: bike-lane construction has begun; nearby routes absorb displaced trips.` }, ...state.events] };
}

export function advanceMonth(state: GameState): GameState {
  const month = state.month + 1;
  let completed: BikeLaneProject | undefined;
  const projects = state.projects.map((project) => {
    if (project.status === 'construction' && project.completesMonth <= month) { completed = { ...project, status: 'complete' }; return completed; }
    return project;
  });
  let roads = state.roads;
  let events = state.events;
  if (completed) {
    roads = recalculateRoads(roads.map((road) => road.id === completed?.roadId ? { ...road, capacityModifier: 1, demandModifier: road.demandModifier * (1 - completed.demandReduction) } : road));
    events = [{ id: `complete-${completed.id}`, month, tone: 'success', message: `${completed.roadName} bike lane is open. Simulated car demand has shifted to active travel.` }, ...events];
  }
  const average = roads.reduce((total, road) => total + road.congestion, 0) / roads.length;
  return { ...state, month, roads, projects, approval: Math.round(Math.max(20, Math.min(80, 58 - average * 18 + projects.filter((project) => project.status === 'complete').length * 3))), events };
}
