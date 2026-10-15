/**
 * Project type registry. Each type declares how it modifies traffic in each phase.
 */
import { PROJECT_CONFIG, type ProjectTypeConfig, type ProjectTypeId } from '../../config/projects';
import { applyCapacityChange, applyDemandChange, type TrafficModifiers } from '../traffic/engine';
import type { RoadNetwork } from '../traffic/network';
import type { Project } from '../state';

export interface ProjectEffectContext {
  network: RoadNetwork;
  /** Resolved segment indices of the project corridor. */
  indices: number[];
  day: number;
}

export interface ProjectTypeDefinition {
  id: ProjectTypeId;
  config: ProjectTypeConfig;
  /** Mutates `modifiers` with this project's effect on the given day. */
  applyEffects(project: Project, ctx: ProjectEffectContext, modifiers: TrafficModifiers): void;
}

/** Mode-shift ramp after completion (0..1). */
export function rampProgress(project: Project, day: number, rampUpDays: number): number {
  if (project.completedDay === null) return 0;
  if (rampUpDays <= 0) return 1;
  return Math.min(1, Math.max(0, (day - project.completedDay) / rampUpDays));
}

/** Unique alternatives of a corridor, excluding the corridor itself. */
export function corridorCatchment(network: RoadNetwork, indices: readonly number[]): number[] {
  const inCorridor = new Set(indices);
  const out = new Set<number>();
  for (const i of indices) {
    for (const a of network.segments[i].alternatives) if (!inCorridor.has(a.index)) out.add(a.index);
  }
  return [...out];
}

/** Shared effect model for corridor projects. */
function corridorEffects(cfg: ProjectTypeConfig): ProjectTypeDefinition['applyEffects'] {
  return (project, ctx, modifiers) => {
    if (project.phase === 'construction') {
      applyCapacityChange(modifiers, ctx.indices, cfg.constructionCapacityFactor);
    } else if (project.phase === 'completed') {
      applyCapacityChange(modifiers, ctx.indices, cfg.completedCapacityFactor);
      const r = rampProgress(project, ctx.day, cfg.rampUpDays);
      if (r > 0) {
        applyDemandChange(modifiers, ctx.indices, 1 - cfg.corridorDemandReduction * r);
        applyDemandChange(
          modifiers,
          corridorCatchment(ctx.network, ctx.indices),
          1 - cfg.catchmentDemandReduction * r,
        );
      }
    }
  };
}

export const PROJECT_TYPES: Record<ProjectTypeId, ProjectTypeDefinition> = {
  bikeLane: {
    id: 'bikeLane',
    config: PROJECT_CONFIG.bikeLane,
    applyEffects: corridorEffects(PROJECT_CONFIG.bikeLane),
  },
  brt: {
    id: 'brt',
    config: PROJECT_CONFIG.brt,
    applyEffects: corridorEffects(PROJECT_CONFIG.brt),
  },
  elevatedMetro: {
    id: 'elevatedMetro',
    config: PROJECT_CONFIG.elevatedMetro,
    applyEffects: corridorEffects(PROJECT_CONFIG.elevatedMetro),
  },
  subway: {
    id: 'subway',
    config: PROJECT_CONFIG.subway,
    applyEffects: corridorEffects(PROJECT_CONFIG.subway),
  },
  roundabout: {
    id: 'roundabout',
    config: PROJECT_CONFIG.roundabout,
    applyEffects: corridorEffects(PROJECT_CONFIG.roundabout),
  },
};

export function projectCost(cfg: ProjectTypeConfig, streetKm: number): number {
  return Math.round((cfg.baseCost + cfg.costPerKm * streetKm) / 1000) * 1000;
}

export function constructionDays(cfg: ProjectTypeConfig, streetKm: number): number {
  return Math.max(
    cfg.minConstructionDays,
    Math.round(cfg.constructionBaseDays + cfg.constructionDaysPerKm * streetKm),
  );
}
