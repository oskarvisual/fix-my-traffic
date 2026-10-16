import { describe, expect, it } from 'vitest';
import { buildRoadNetwork, getAllAvenueSegments } from '../src/simulation/traffic/network';
import { computeTraffic, createModifiers, applyCapacityChange, applyDemandChange } from '../src/simulation/traffic/engine';
import { createNewGame, advanceDays, approveProject, type SimulationContext } from '../src/simulation/game';
import type { CityRoadDataset } from '../src/data/cityDataset';

// Minimal mock fixture for deterministic testing
const testDataset: CityRoadDataset = {
  schemaVersion: 1,
  city: {
    id: 'test-city',
    name: 'Test City',
    country: 'Testing',
    center: [-77.0, -12.0],
    bbox: [-12.1, -77.1, -11.9, -76.9],
  },
  version: {
    datasetVersion: 1,
    generatedAt: '2026-10-13T00:00:00Z',
    roadNetworkVersion: 'test-v1',
    dataSources: [],
  },
  stats: {
    segmentCount: 2,
    nodeCount: 3,
    totalKm: 2,
    kmByType: { primary: 1, secondary: 1 },
  },
  roadTypes: ['primary', 'secondary'],
  names: ['Main Ave', 'Parallel St'],
  nodes: [
    [-77.0, -12.0],
    [-77.01, -12.0],
    [-77.02, -12.0],
  ],
  segments: [
    [
      'seg-main',
      0,
      0, // primary
      3,
      50,
      0,
      1000,
      0,
      1,
      [[-77.0, -12.0], [-77.01, -12.0]],
      [[1, 0.8]], // alternative is seg-parallel
      [],
      0,
    ],
    [
      'seg-parallel',
      1,
      1, // secondary
      2,
      40,
      0,
      1000,
      1,
      2,
      [[-77.01, -12.0], [-77.02, -12.0]],
      [[0, 0.8]],
      [],
      0,
    ],
  ],
};

const network = buildRoadNetwork(testDataset);
const baselineDemand = [3000, 1500];
const ctx: SimulationContext = { network, baselineDemand };

describe('Traffic Engine Invariants', () => {
  it('increases congestion when capacity is reduced', () => {
    const normalMods = createModifiers(network.segments.length);
    const normalState = computeTraffic(network, baselineDemand, normalMods);

    const reducedMods = createModifiers(network.segments.length);
    applyCapacityChange(reducedMods, [0], 0.5);
    const reducedState = computeTraffic(network, baselineDemand, reducedMods);

    expect(reducedState.congestion[0]).toBeGreaterThan(normalState.congestion[0]);
  });

  it('redistributes traffic to parallel alternatives when capacity is lost', () => {
    const normalMods = createModifiers(network.segments.length);
    const normalState = computeTraffic(network, baselineDemand, normalMods);

    const reducedMods = createModifiers(network.segments.length);
    applyCapacityChange(reducedMods, [0], 0.6);
    const reducedState = computeTraffic(network, baselineDemand, reducedMods);

    // Parallel route should absorb part of the displaced demand
    expect(reducedState.currentDemand[1]).toBeGreaterThan(normalState.currentDemand[1]);
  });

  it('decreases congestion when demand is reduced', () => {
    const normalMods = createModifiers(network.segments.length);
    const normalState = computeTraffic(network, baselineDemand, normalMods);

    const demandReducedMods = createModifiers(network.segments.length);
    applyDemandChange(demandReducedMods, [0], 0.7);
    const demandReducedState = computeTraffic(network, baselineDemand, demandReducedMods);

    expect(demandReducedState.congestion[0]).toBeLessThan(normalState.congestion[0]);
  });

  it('diverts over 90% of traffic to parallel streets when a corridor is closed for elevated metro or major works', () => {
    const normalMods = createModifiers(network.segments.length);
    const normalState = computeTraffic(network, baselineDemand, normalMods);

    const closedMods = createModifiers(network.segments.length);
    applyCapacityChange(closedMods, [0], 0.05); // 95% closure for elevated metro construction
    const closedState = computeTraffic(network, baselineDemand, closedMods);

    // Closed street is virtually empty of car traffic
    expect(closedState.currentDemand[0]).toBeLessThan(normalState.currentDemand[0] * 0.1);
    // Closed street normal congestion is 0 (blocked for works, empty of traffic)
    expect(closedState.congestion[0]).toBe(0);
    // Parallel street absorbs the heavy diverted traffic
    expect(closedState.currentDemand[1]).toBeGreaterThan(normalState.currentDemand[1] * 1.5);
    // Parallel street suffers high congestion
    expect(closedState.congestion[1]).toBeGreaterThan(normalState.congestion[1]);
  });
});

describe('Game Lifecycle & Project Flow', () => {
  it('deducts budget upon project approval and advances through planning to construction and completion', () => {
    const game = createNewGame(
      {
        cityId: 'test-city',
        datasetVersion: 1,
        trafficProviderId: 'mock-test',
        seed: 42,
      },
      ctx,
    );

    const initialBudget = game.finance.publicBudget;
    const approval = approveProject(game, ctx, {
      typeId: 'bikeLane',
      indices: [0],
    });

    expect(approval.ok).toBe(true);
    if (!approval.ok) return;

    const startedGame = approval.state;
    expect(startedGame.finance.publicBudget).toBeLessThan(initialBudget);
    expect(startedGame.projects.length).toBe(1);

    const project = startedGame.projects[0];
    expect(project.phase).toBe('planning');

    // Advance through planning days
    const gameInConstruction = advanceDays(startedGame, ctx, project.planningDays + 2);
    expect(gameInConstruction.projects[0].phase).toBe('construction');

    // Advance through construction days
    const completedGame = advanceDays(gameInConstruction, ctx, project.constructionDays + 10);
    expect(completedGame.projects[0].phase).toBe('completed');
  });

  it('fails approval when funds are insufficient or corridor is empty', () => {
    const game = createNewGame(
      {
        cityId: 'test-city',
        datasetVersion: 1,
        trafficProviderId: 'mock-test',
        seed: 42,
      },
      ctx,
    );

    const emptyResult = approveProject(game, ctx, {
      typeId: 'bikeLane',
      indices: [],
    });
    expect(emptyResult.ok).toBe(false);

    // Drain budget
    const poorGame = {
      ...game,
      finance: { ...game.finance, publicBudget: 0 },
    };
    const poorResult = approveProject(poorGame, ctx, {
      typeId: 'bikeLane',
      indices: [0],
    });
    expect(poorResult.ok).toBe(false);
    if (!poorResult.ok) {
      expect(poorResult.reason).toBe('insufficientFunds');
    }
  });

  it('supports contractor bidding with bribes and corruption gains', () => {
    const game = createNewGame(
      {
        cityId: 'test-city',
        datasetVersion: 1,
        trafficProviderId: 'mock-test',
        seed: 42,
      },
      ctx,
    );

    const initialPersonal = game.finance.personalBalance;
    const initialCorruption = game.politics.corruption;

    const approval = approveProject(game, ctx, {
      typeId: 'brt',
      indices: [0],
      contractorBid: {
        id: 'corrupt-1',
        name: 'OdeVial S.A.',
        country: 'Privado',
        reputation: 'corrupt',
        headline: 'Coima jugosa',
        pros: ['Rápido'],
        cons: ['Corrupto'],
        costMultiplier: 1.15,
        durationMultiplier: 1.0,
        delayRisk: 0.2,
        bribeOffer: 50_000,
        corruptionRisk: 0.25,
      },
    });

    expect(approval.ok).toBe(true);
    if (!approval.ok) return;

    expect(approval.state.finance.personalBalance).toBe(initialPersonal + 50_000);
    expect(approval.state.politics.corruption).toBe(initialCorruption + 0.25);
    expect(approval.state.projects[0].contractor?.name).toBe('OdeVial S.A.');
  });

  it('triggers general elections after 5 years (1826 days), rejecting ministers who allow congestion to grow', () => {
    const game = createNewGame(
      {
        cityId: 'test-city',
        datasetVersion: 1,
        trafficProviderId: 'mock-test',
        seed: 42,
      },
      ctx,
    );

    // After 5 years of natural demand growth without transit, voters vote the minister out
    const termEndedGame = advanceDays(game, ctx, 1826);
    expect(termEndedGame.status).toBe('gameOver');
    expect(termEndedGame.gameOverReason).toBe('electionDefeat');
  });

  it('selects all matching segments of an avenue via getAllAvenueSegments', () => {
    const segs = getAllAvenueSegments(network, 0);
    expect(segs).toContain(0);
  });
});

