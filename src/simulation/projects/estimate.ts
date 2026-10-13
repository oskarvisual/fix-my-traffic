/**
 * Project preview: runs the engine on hypothetical futures (under construction,
 * fully ramped after completion) and compares with today. Estimates only.
 */
import {
  buildProject,
  computeGameTraffic,
  draftProjectParams,
  validateDraft,
  type DraftError,
  type ProjectDraft,
  type SimulationContext,
} from '../game';
import type { GameState, Project } from '../state';
import { averageCongestion } from '../traffic/engine';
import { corridorCatchment } from './projectTypes';

export interface CongestionTriple {
  now: number;
  duringConstruction: number;
  afterCompletion: number;
}

export interface ProjectEstimate {
  streetKm: number;
  cost: number;
  planningDays: number;
  constructionDays: number;
  corridor: CongestionTriple;
  /** Nearby alternative roads that absorb displaced traffic. */
  surroundings: CongestionTriple;
  network: CongestionTriple;
  /** Most-affected alternative during construction. */
  worstNeighbor: { index: number; now: number; duringConstruction: number } | null;
  error: DraftError | null;
}

export function estimateProject(
  state: GameState,
  ctx: SimulationContext,
  draft: ProjectDraft,
): ProjectEstimate {
  const params = draftProjectParams(ctx, draft);
  const error = validateDraft(state, ctx, draft);
  const base = buildProject(state, ctx, draft);
  const day = state.clock.day;
  const building: Project = { ...base, phase: 'construction', phaseStartDay: day };
  const rampDays = params.cfg.rampUpDays;
  const done: Project = { ...base, phase: 'completed', progress: 1, completedDay: day - rampDays };

  const now = computeGameTraffic(state, ctx);
  const during = computeGameTraffic(state, ctx, [...state.projects, building]);
  const after = computeGameTraffic(state, ctx, [...state.projects, done]);

  const corridor = draft.indices;
  const catchment = corridorCatchment(ctx.network, corridor);
  const triple = (indices?: number[]): CongestionTriple => ({
    now: averageCongestion(ctx.network, now, indices),
    duringConstruction: averageCongestion(ctx.network, during, indices),
    afterCompletion: averageCongestion(ctx.network, after, indices),
  });

  let worstNeighbor: ProjectEstimate['worstNeighbor'] = null;
  for (const i of catchment) {
    const delta = during.congestion[i] - now.congestion[i];
    if (!worstNeighbor || delta > worstNeighbor.duringConstruction - worstNeighbor.now) {
      worstNeighbor = { index: i, now: now.congestion[i], duringConstruction: during.congestion[i] };
    }
  }

  return {
    streetKm: params.streetKm,
    cost: params.cost,
    planningDays: params.planningDays,
    constructionDays: params.constructionDays,
    corridor: triple(corridor),
    surroundings: catchment.length ? triple(catchment) : triple(corridor),
    network: triple(),
    worstNeighbor,
    error,
  };
}
