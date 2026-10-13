import { POLITICS_CONFIG } from '../../config/game';
import type { GameState } from '../state';

/**
 * Monthly approval drift (placeholder for the full Phase 8 political model).
 * Approval drifts toward a target driven by congestion vs. day one, active
 * construction disruption and completed projects.
 */
export function approvalTarget(state: GameState, networkCongestion: number): number {
  const c = POLITICS_CONFIG;
  const improvementPoints = (state.politics.baselineCongestion - networkCongestion) * 100;
  const underConstruction = state.projects.filter((p) => p.phase === 'construction').length;
  const completed = state.projects.filter((p) => p.phase === 'completed').length;
  const target =
    c.initialApproval +
    improvementPoints * c.approvalPerCongestionPoint -
    Math.min(3, underConstruction) * c.constructionDisruptionPenalty +
    Math.min(c.maxCompletedProjectBonus, completed * c.completedProjectBonus);
  return Math.min(c.maxApproval, Math.max(c.minApproval, target));
}

export function updateApproval(state: GameState, networkCongestion: number): number {
  const target = approvalTarget(state, networkCongestion);
  const next = state.politics.approval + (target - state.politics.approval) * POLITICS_CONFIG.monthlyApprovalInertia;
  return Math.min(POLITICS_CONFIG.maxApproval, Math.max(POLITICS_CONFIG.minApproval, next));
}
