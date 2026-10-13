import { describe, expect, it } from 'vitest';
import { advanceMonth, approveBikeLane, initialGame } from '../src/simulation/game';
import { congestionFor, redistributeTraffic } from '../src/simulation/traffic';

describe('traffic vertical slice', () => {
  it('increases congestion when capacity is reduced', () => { const road = initialGame().roads[0]; expect(congestionFor({ ...road, capacityModifier: .7 })).toBeGreaterThan(congestionFor(road)); });
  it('moves part of displaced demand to nearby alternatives', () => { const game = initialGame(); const initial = game.roads.find((road) => road.id === 'canada')!; const next = redistributeTraffic(game.roads, 'javier-prado', 1000); expect(next.find((road) => road.id === 'canada')!.demandModifier).toBeGreaterThan(initial.demandModifier); });
  it('starts construction, deducts budget, then applies permanent demand relief', () => { const initial = initialGame(); const started = approveBikeLane(initial, 'javier-prado'); expect(started.publicBudget).toBeLessThan(initial.publicBudget); expect(started.projects[0].status).toBe('construction'); let finished = started; for (let month = 0; month < 6; month += 1) finished = advanceMonth(finished); expect(finished.projects[0].status).toBe('complete'); expect(finished.roads.find((road) => road.id === 'javier-prado')!.demandModifier).toBeLessThan(1); });
});
