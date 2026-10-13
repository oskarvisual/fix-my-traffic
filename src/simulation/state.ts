/**
 * Serializable game state. Everything here must be plain JSON so that a save
 * round-trip reproduces the exact game. Traffic values are NOT stored: they are
 * derived deterministically from (dataset, baseline, state).
 */
import type { ProjectTypeId } from '../config/projects';

export const GAME_STATE_SCHEMA_VERSION = 1;

export type ProjectPhase = 'planning' | 'procurement' | 'construction' | 'completed';

export interface Project {
  id: string;
  typeId: ProjectTypeId;
  /** Display name, usually the main street. */
  name: string;
  /** Stable dataset segment ids (not indices) so saves survive re-ordering. */
  segmentIds: string[];
  streetKm: number;
  cost: number;
  approvedDay: number;
  phase: ProjectPhase;
  phaseStartDay: number;
  planningDays: number;
  constructionDays: number;
  /** Construction progress 0..1. */
  progress: number;
  completedDay: number | null;
}

export type NewsSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface NewsItem {
  id: string;
  day: number;
  severity: NewsSeverity;
  /** i18n message key; text is resolved in the presentation layer. */
  key: string;
  params: Record<string, string | number>;
  projectId?: string;
  segmentId?: string;
}

export interface GameState {
  schemaVersion: number;
  id: string;
  cityId: string;
  datasetVersion: number;
  trafficProviderId: string;
  seed: number;
  rngState: number;
  status: 'active' | 'gameOver';
  clock: {
    /** Days elapsed since TIME_CONFIG.startDate. */
    day: number;
    /** Fraction of the current day already simulated (0..1). */
    dayProgress: number;
  };
  finance: {
    publicBudget: number;
    personalBalance: number;
    totalPublicSpent: number;
  };
  politics: {
    approval: number;
    /** Network congestion when the minister took office. */
    baselineCongestion: number;
    term: { number: number; startDay: number };
  };
  projects: Project[];
  news: NewsItem[];
  /** Last monthly average congestion per major street name, for news deltas. */
  roadReport: Record<string, number>;
  nextId: number;
}
