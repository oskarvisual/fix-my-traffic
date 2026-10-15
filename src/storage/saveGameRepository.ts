import { GAME_STATE_SCHEMA_VERSION, type GameState } from '../simulation/state';
import type { KeyValueStore } from './keyValueStore';

const CURRENT_SLOT = 'current';

interface SaveEnvelope {
  savedAt: string;
  state: GameState;
}

/** Local-first player saves. Supabase never stores player games in the MVP. */
export class SaveGameRepository {
  constructor(private readonly store: KeyValueStore) {}

  async save(state: GameState, slot = CURRENT_SLOT): Promise<void> {
    const envelope: SaveEnvelope = { savedAt: new Date().toISOString(), state };
    await this.store.set(`save:${slot}`, envelope);
  }

  async load(slot = CURRENT_SLOT): Promise<GameState | null> {
    const envelope = await this.store.get<SaveEnvelope>(`save:${slot}`);
    if (!envelope?.state) return null;
    return migrate(envelope.state);
  }

  async clear(slot = CURRENT_SLOT): Promise<void> {
    await this.store.delete(`save:${slot}`);
  }
}

/** Upgrades older save schemas. Returns null for unsupported saves. */
export function migrate(state: GameState): GameState | null {
  if (state.schemaVersion === GAME_STATE_SCHEMA_VERSION && (state.datasetVersion ?? 1) >= 2) {
    return state;
  }
  return null;
}
