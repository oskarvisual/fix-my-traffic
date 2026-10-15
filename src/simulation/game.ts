/**
 * Game orchestration: pure functions (state, context) -> new state.
 * No React, no MapLibre, no I/O.
 */
import { CORRUPTION_CONFIG, ECONOMY_CONFIG, NEWS_CONFIG, POLITICS_CONFIG, TIME_CONFIG } from '../config/game';
import type { ProjectTypeId } from '../config/projects';
import { canAffordPublic, depositAnnualBudget, payMonthlySalary, spendPublic } from './finance/budget';
import { updateApproval } from './politics/approval';
import { advanceProjectDay } from './projects/lifecycle';
import { constructionDays, PROJECT_TYPES, projectCost } from './projects/projectTypes';
import type { ContractorBid } from './projects/contractors';
import { hashString, randomFor } from './random';
import { GAME_STATE_SCHEMA_VERSION, type GameState, type NewsItem, type Project } from './state';
import { isFirstDayOfMonth, isFirstDayOfYear } from './time/clock';
import {
  averageCongestion,
  computeTraffic,
  createModifiers,
  demandGrowthFactor,
  type TrafficState,
} from './traffic/engine';
import { corridorStreetKm, type RoadNetwork } from './traffic/network';

export interface SimulationContext {
  network: RoadNetwork;
  baselineDemand: readonly number[];
}

export function resolveProjectIndices(
  network: RoadNetwork,
  project: Pick<Project, 'segmentIds'>,
): number[] {
  const out: number[] = [];
  for (const id of project.segmentIds) {
    const idx = network.indexById.get(id);
    if (idx !== undefined) out.push(idx);
  }
  return out;
}

export function computeGameTraffic(
  state: GameState,
  ctx: SimulationContext,
  projects: readonly Project[] = state.projects,
  day: number = state.clock.day,
): TrafficState {
  const modifiers = createModifiers(ctx.network.segments.length);
  for (const project of projects) {
    PROJECT_TYPES[project.typeId].applyEffects(
      project,
      { network: ctx.network, indices: resolveProjectIndices(ctx.network, project), day },
      modifiers,
    );
  }
  return computeTraffic(ctx.network, ctx.baselineDemand, modifiers, demandGrowthFactor(day));
}

export interface NewGameOptions {
  cityId: string;
  datasetVersion: number;
  trafficProviderId: string;
  seed: number;
  id?: string;
}

export function createNewGame(options: NewGameOptions, ctx: SimulationContext): GameState {
  const draft: GameState = {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    id: options.id ?? `game-${options.seed.toString(36)}`,
    cityId: options.cityId,
    datasetVersion: options.datasetVersion,
    trafficProviderId: options.trafficProviderId,
    seed: options.seed,
    rngState: hashString(`rng:${options.seed}`),
    status: 'active',
    clock: { day: 0, dayProgress: 0 },
    finance: {
      publicBudget: ECONOMY_CONFIG.initialPublicBudget,
      personalBalance: ECONOMY_CONFIG.initialPersonalBalance,
      totalPublicSpent: 0,
      totalBribesReceived: 0,
    },
    politics: {
      approval: POLITICS_CONFIG.initialApproval,
      baselineCongestion: 0,
      term: { number: 1, startDay: 0 },
      corruption: 0,
      investigationActive: false,
      lowApprovalMonths: 0,
    },
    projects: [],
    news: [],
    roadReport: {},
    nextId: 1,
  };
  const traffic = computeGameTraffic(draft, ctx);
  const withBaseline: GameState = {
    ...draft,
    politics: { ...draft.politics, baselineCongestion: averageCongestion(ctx.network, traffic) },
    roadReport: streetReport(ctx.network, traffic),
  };
  return addNews(withBaseline, [{ day: 0, severity: 'info', key: 'news.tookOffice', params: {} }]);
}

export function addNews(state: GameState, items: Omit<NewsItem, 'id'>[]): GameState {
  if (items.length === 0) return state;
  let nextId = state.nextId;
  const created = items.map((item) => ({ ...item, id: `n${nextId++}` }));
  return {
    ...state,
    nextId,
    news: [...created.reverse(), ...state.news].slice(0, NEWS_CONFIG.maxItems),
  };
}

const MAJOR_TYPES = new Set(['motorway', 'trunk', 'primary']);

/** Length-weighted congestion per named major street. */
export function streetReport(
  network: RoadNetwork,
  traffic: Pick<TrafficState, 'congestion'>,
): Record<string, number> {
  const sums = new Map<string, [number, number]>();
  for (const s of network.segments) {
    if (!s.name || s.isLink || !MAJOR_TYPES.has(s.roadType)) continue;
    const acc = sums.get(s.name) ?? [0, 0];
    acc[0] += traffic.congestion[s.index] * s.lengthM;
    acc[1] += s.lengthM;
    sums.set(s.name, acc);
  }
  const out: Record<string, number> = {};
  for (const [name, [sum, len]] of sums) {
    if (len >= 1500) out[name] = Math.round((sum / len) * 1000) / 1000;
  }
  return out;
}

function monthlyBulletin(state: GameState, ctx: SimulationContext, day: number): GameState {
  const traffic = computeGameTraffic(state, ctx, state.projects, day);
  const report = streetReport(ctx.network, traffic);
  const changes = Object.entries(report)
    .map(([name, value]) => {
      const prev = state.roadReport[name];
      return { name, rel: prev && prev > 0.05 ? (value - prev) / prev : 0 };
    })
    .filter((c) => Math.abs(c.rel) >= NEWS_CONFIG.roadChangeThreshold)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, NEWS_CONFIG.maxRoadReportsPerMonth);

  const items: Omit<NewsItem, 'id'>[] = changes.map((c) => ({
    day,
    severity: c.rel > 0 ? 'warning' : 'success',
    key: c.rel > 0 ? 'news.trafficIncreased' : 'news.trafficDecreased',
    params: { road: c.name, pct: Math.round(Math.abs(c.rel) * 100) },
  }));

  const networkCongestion = averageCongestion(ctx.network, traffic);
  let approval = updateApproval(state, networkCongestion);

  // Check low approval months
  let lowApprovalMonths = state.politics.lowApprovalMonths;
  let status = state.status;
  let gameOverReason = state.gameOverReason;

  if (approval < POLITICS_CONFIG.impeachmentThreshold) {
    lowApprovalMonths += 1;
    if (lowApprovalMonths >= 2) {
      status = 'gameOver';
      gameOverReason = 'impeached';
      items.push({
        day,
        severity: 'danger',
        key: 'news.impeached',
        params: { approval: Math.round(approval * 100) },
      });
    } else {
      items.push({
        day,
        severity: 'danger',
        key: 'news.censureWarning',
        params: { approval: Math.round(approval * 100) },
      });
    }
  } else {
    lowApprovalMonths = 0;
  }

  // Check corruption & investigations
  let corruption = state.politics.corruption;
  let investigationActive = state.politics.investigationActive;

  if (corruption >= CORRUPTION_CONFIG.arrestThreshold && status === 'active') {
    status = 'gameOver';
    gameOverReason = 'corruptionScandal';
    items.push({
      day,
      severity: 'danger',
      key: 'news.arrestedCorruption',
      params: { bribes: state.finance.totalBribesReceived },
    });
  } else if (corruption >= CORRUPTION_CONFIG.investigationRiskThreshold && !investigationActive) {
    const roll = randomFor(state.seed, `corrupt:${day}`);
    if (roll < CORRUPTION_CONFIG.investigationMonthlyChance) {
      investigationActive = true;
      approval = Math.max(0.05, approval - CORRUPTION_CONFIG.scandalApprovalPenalty);
      items.push({
        day,
        severity: 'danger',
        key: 'news.investigationStarted',
        params: {},
      });
    }
  }

  // Check Elections every 5 years
  const daysInTerm = day - state.politics.term.startDay;
  let term = state.politics.term;
  let publicBudget = state.finance.publicBudget;

  if (daysInTerm >= TIME_CONFIG.daysPerTerm && status === 'active') {
    if (approval >= POLITICS_CONFIG.electionWinThreshold) {
      term = { number: term.number + 1, startDay: day };
      publicBudget += 200_000_000; // Bonus election victory budget
      items.push({
        day,
        severity: 'success',
        key: 'news.electionWon',
        params: { term: term.number, approval: Math.round(approval * 100) },
      });
    } else {
      status = 'gameOver';
      gameOverReason = 'electionDefeat';
      items.push({
        day,
        severity: 'danger',
        key: 'news.electionLost',
        params: { approval: Math.round(approval * 100) },
      });
    }
  }

  const prevPct = Math.round(state.politics.approval * 100);
  const nextPct = Math.round(approval * 100);
  if (Math.abs(nextPct - prevPct) >= 2) {
    items.push({
      day,
      severity: nextPct > prevPct ? 'success' : 'danger',
      key: nextPct > prevPct ? 'news.approvalRose' : 'news.approvalFell',
      params: { pct: nextPct },
    });
  }

  return addNews(
    {
      ...state,
      status,
      gameOverReason,
      roadReport: report,
      finance: { ...state.finance, publicBudget },
      politics: {
        ...state.politics,
        approval,
        corruption,
        investigationActive,
        lowApprovalMonths,
        term,
      },
    },
    items,
  );
}

/** Advances the simulation by exactly one day. */
export function advanceDay(state: GameState, ctx: SimulationContext): GameState {
  if (state.status !== 'active') return state;
  const day = state.clock.day + 1;
  const events: Omit<NewsItem, 'id'>[] = [];
  let next: GameState = {
    ...state,
    clock: { ...state.clock, day },
    projects: state.projects.map((p) => {
      const r = advanceProjectDay(p, day);
      events.push(...r.events);
      return r.project;
    }),
  };
  next = addNews(next, events);

  if (isFirstDayOfYear(day)) {
    next = addNews({ ...next, finance: depositAnnualBudget(next.finance) }, [
      {
        day,
        severity: 'info',
        key: 'news.annualBudget',
        params: { amount: ECONOMY_CONFIG.annualTransportBudget },
      },
    ]);
  }
  if (isFirstDayOfMonth(day)) {
    next = monthlyBulletin({ ...next, finance: payMonthlySalary(next.finance) }, ctx, day);
  }
  return next;
}

export function advanceDays(state: GameState, ctx: SimulationContext, days: number): GameState {
  let s = state;
  for (let i = 0; i < days; i++) s = advanceDay(s, ctx);
  return s;
}

export interface ProjectDraft {
  typeId: ProjectTypeId;
  indices: number[];
  contractorBid?: ContractorBid;
  subwayStations?: Array<{ name: string; coordinates: [number, number] }>;
  subwayAlignment?: Array<[number, number]>;
  customName?: string;
  customCost?: number;
  customStreetKm?: number;
}

export type DraftError = 'empty' | 'tooShort' | 'tooLong' | 'insufficientFunds' | 'gameOver';

export type ApproveResult =
  | { ok: true; state: GameState; project: Project }
  | { ok: false; reason: DraftError };

export function draftProjectParams(ctx: SimulationContext, draft: ProjectDraft) {
  const cfg = PROJECT_TYPES[draft.typeId].config;
  const streetKm = draft.customStreetKm ?? corridorStreetKm(ctx.network, draft.indices);
  const costMultiplier = draft.contractorBid?.costMultiplier ?? 1;
  const durationMultiplier = draft.contractorBid?.durationMultiplier ?? 1;
  const rawCost = draft.customCost ?? projectCost(cfg, streetKm);
  const rawConstructionDays = constructionDays(cfg, streetKm);

  return {
    cfg,
    streetKm,
    cost: Math.round((rawCost * costMultiplier) / 1000) * 1000,
    planningDays: Math.round(cfg.planningDays * durationMultiplier),
    constructionDays: Math.round(rawConstructionDays * durationMultiplier),
  };
}

export function validateDraft(
  state: GameState,
  ctx: SimulationContext,
  draft: ProjectDraft,
): DraftError | null {
  if (state.status !== 'active') return 'gameOver';
  if (draft.indices.length === 0 && (!draft.subwayStations || draft.subwayStations.length < 2)) return 'empty';
  const { cfg, streetKm, cost } = draftProjectParams(ctx, draft);
  if (streetKm < cfg.minCorridorKm) return 'tooShort';
  if (streetKm > cfg.maxCorridorKm) return 'tooLong';
  if (!canAffordPublic(state, cost)) return 'insufficientFunds';
  return null;
}

export function mainStreetName(network: RoadNetwork, indices: readonly number[]): string {
  const byName = new Map<string, number>();
  for (const i of indices) {
    const s = network.segments[i];
    if (s.name) byName.set(s.name, (byName.get(s.name) ?? 0) + s.lengthM);
  }
  return [...byName.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export function buildProject(state: GameState, ctx: SimulationContext, draft: ProjectDraft): Project {
  const unique = [...new Set(draft.indices)];
  const params = draftProjectParams(ctx, { ...draft, indices: unique });
  const bid = draft.contractorBid;

  const defaultName = draft.typeId === 'subway'
    ? `Línea Subterránea (${draft.subwayStations?.length ?? 0} estaciones)`
    : mainStreetName(ctx.network, unique);

  return {
    id: `p${state.nextId}`,
    typeId: draft.typeId,
    name: draft.customName || defaultName || 'Proyecto Metropolitano',
    segmentIds: unique.map((i) => ctx.network.segments[i].id),
    streetKm: Math.round(params.streetKm * 100) / 100,
    cost: params.cost,
    approvedDay: state.clock.day,
    phase: params.planningDays > 0 ? 'planning' : 'construction',
    phaseStartDay: state.clock.day,
    planningDays: params.planningDays,
    constructionDays: params.constructionDays,
    progress: 0,
    completedDay: null,
    contractor: bid
      ? {
          id: bid.id,
          name: bid.name,
          bribeReceived: bid.bribeOffer,
          corruptionRisk: bid.corruptionRisk,
          delayRisk: bid.delayRisk,
        }
      : undefined,
    subwayStations: draft.subwayStations,
    subwayAlignment: draft.subwayAlignment,
  };
}

export function approveProject(
  state: GameState,
  ctx: SimulationContext,
  draft: ProjectDraft,
): ApproveResult {
  const reason = validateDraft(state, ctx, draft);
  if (reason) return { ok: false, reason };
  const project = buildProject(state, ctx, draft);
  let finance = spendPublic(state, project.cost);

  let corruption = state.politics.corruption;
  const bid = draft.contractorBid;
  if (bid && bid.bribeOffer > 0) {
    finance = {
      ...finance,
      personalBalance: finance.personalBalance + bid.bribeOffer,
      totalBribesReceived: finance.totalBribesReceived + bid.bribeOffer,
    };
    corruption = Math.min(1.0, corruption + bid.corruptionRisk);
  }

  const newsItems: Omit<NewsItem, 'id'>[] = [
    {
      day: state.clock.day,
      severity: 'info',
      key: 'news.projectApproved',
      params: { name: project.name, cost: project.cost },
      projectId: project.id,
    },
  ];

  if (bid && bid.bribeOffer > 0) {
    newsItems.push({
      day: state.clock.day,
      severity: 'warning',
      key: 'news.contractAwardedSuspicion',
      params: { company: bid.name },
      projectId: project.id,
    });
  }

  const next = addNews(
    {
      ...state,
      finance,
      politics: { ...state.politics, corruption },
      nextId: state.nextId + 1,
      projects: [...state.projects, project],
    },
    newsItems,
  );
  return { ok: true, state: next, project };
}

export function cancelProject(state: GameState, projectId: string): GameState {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return state;
  // 70% refund of project cost back to public budget
  const refund = Math.round(project.cost * 0.70);
  const nextProjects = state.projects.filter((p) => p.id !== projectId);
  const nextFinance = {
    ...state.finance,
    publicBudget: state.finance.publicBudget + refund,
  };
  return addNews(
    {
      ...state,
      projects: nextProjects,
      finance: nextFinance,
    },
    [
      {
        day: state.clock.day,
        severity: 'warning',
        key: 'news.projectCancelled',
        params: { name: project.name, refund },
        projectId: project.id,
      },
    ],
  );
}

