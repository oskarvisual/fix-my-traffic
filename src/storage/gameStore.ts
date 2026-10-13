import { get, set } from 'idb-keyval';
import type { GameState } from '../domain/types';

const KEY = 'fix-my-traffic:game:v1';
export const gameStore = { load: () => get<GameState>(KEY), save: (state: GameState) => set(KEY, state), clear: () => set(KEY, undefined) };
