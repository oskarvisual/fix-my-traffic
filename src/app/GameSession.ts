/**
 * Runtime session: owns the authoritative GameState, the derived traffic state,
 * the real-time clock loop and autosave. Framework-agnostic; React subscribes
 * through `subscribe/getSnapshot` (useSyncExternalStore-compatible).
 */
import { TIME_CONFIG } from '../config/game';
import {
  advanceDay,
  approveProject,
  cancelProject,
  computeGameTraffic,
  type ApproveResult,
  type ProjectDraft,
  type SimulationContext,
} from '../simulation/game';
import type { GameState } from '../simulation/state';
import { simDaysForRealTime } from '../simulation/time/clock';
import type { TrafficState } from '../simulation/traffic/engine';
import type { SaveGameRepository } from '../storage/saveGameRepository';

export interface SessionSnapshot {
  state: GameState;
  traffic: TrafficState;
  speed: number;
  lastSavedAt: number | null;
}

const AUTOSAVE_INTERVAL_MS = 2000;

export class GameSession {
  private snapshot: SessionSnapshot;
  private listeners = new Set<() => void>();
  private rafId: number | null = null;
  private bgIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastFrame: number | null = null;
  private dayProgress: number;
  private dirty = false;
  private lastSaveMs = 0;
  private detachLifecycle: (() => void) | null = null;

  constructor(
    readonly ctx: SimulationContext,
    initial: GameState,
    private readonly saves: SaveGameRepository | null,
  ) {
    this.dayProgress = initial.clock.dayProgress;
    this.snapshot = {
      state: initial,
      traffic: computeGameTraffic(initial, ctx),
      speed: 1, // Default speed is 1x normal simulation
      lastSavedAt: null,
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private emit(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  /** Start the real-time loop and browser lifecycle hooks. Keeps running even when tab is in background. */
  start(): void {
    if (typeof window === 'undefined' || this.rafId !== null) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab is hidden / backgrounded: autosave and keep ticking via interval
        void this.save();
        if (this.bgIntervalId === null) {
          this.bgIntervalId = setInterval(() => {
            if (this.snapshot.speed > 0) {
              const now = performance.now();
              const dt = this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
              this.lastFrame = now;
              this.tick(Math.min(dt, 2.0));
            }
          }, 500);
        }
      } else {
        // Tab restored to foreground: clear background interval, resume RAF
        if (this.bgIntervalId !== null) {
          clearInterval(this.bgIntervalId);
          this.bgIntervalId = null;
        }
        this.lastFrame = performance.now();
      }
    };

    const onPageHide = () => void this.save();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    this.detachLifecycle = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      if (this.bgIntervalId !== null) {
        clearInterval(this.bgIntervalId);
        this.bgIntervalId = null;
      }
    };

    const frame = (now: number) => {
      if (document.visibilityState !== 'hidden') {
        const dt = this.lastFrame === null ? 0 : (now - this.lastFrame) / 1000;
        this.lastFrame = now;
        this.tick(Math.min(dt, 0.25));
      }
      this.rafId = requestAnimationFrame(frame);
    };

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.bgIntervalId !== null) {
      clearInterval(this.bgIntervalId);
      this.bgIntervalId = null;
    }
    this.lastFrame = null;
    this.detachLifecycle?.();
    this.detachLifecycle = null;
    void this.save();
  }

  setSpeed(speed: number): void {
    if (speed === this.snapshot.speed) return;
    this.emit({ speed });
    if (speed === 0) void this.save();
  }

  /** Advance by real elapsed seconds at the current speed. Public for tests. */
  tick(realSeconds: number): void {
    const { speed, state } = this.snapshot;
    if (speed <= 0 || state.status !== 'active') return;
    this.dayProgress += simDaysForRealTime(realSeconds, speed);
    let s = state;
    let days = 0;
    while (this.dayProgress >= 1 && days < TIME_CONFIG.maxSimDaysPerFrame) {
      s = advanceDay(s, this.ctx);
      this.dayProgress -= 1;
      days++;
    }
    if (this.dayProgress >= 1) this.dayProgress = 0.999; // drop excess instead of spiralling
    if (days > 0) {
      this.dirty = true;
      this.emit({ state: s, traffic: computeGameTraffic(s, this.ctx) });
      if (performance.now() - this.lastSaveMs > AUTOSAVE_INTERVAL_MS) void this.save();
    }
  }

  /** Advance whole days immediately (used by tests and debug tools). */
  advanceDays(days: number): void {
    let s = this.snapshot.state;
    for (let i = 0; i < days; i++) s = advanceDay(s, this.ctx);
    this.dirty = true;
    this.emit({ state: s, traffic: computeGameTraffic(s, this.ctx) });
  }

  approve(draft: ProjectDraft): ApproveResult {
    const result = approveProject(this.snapshot.state, this.ctx, draft);
    if (result.ok) {
      this.dirty = true;
      this.emit({ state: result.state, traffic: computeGameTraffic(result.state, this.ctx) });
      void this.save();
    }
    return result;
  }

  cancel(projectId: string): void {
    const nextState = cancelProject(this.snapshot.state, projectId);
    this.dirty = true;
    this.emit({ state: nextState, traffic: computeGameTraffic(nextState, this.ctx) });
    void this.save();
  }

  currentStateForSave(): GameState {
    const s = this.snapshot.state;
    return { ...s, clock: { ...s.clock, dayProgress: this.dayProgress } };
  }

  async save(): Promise<void> {
    if (!this.saves) return;
    this.lastSaveMs = performance.now();
    const wasDirty = this.dirty;
    this.dirty = false;
    try {
      await this.saves.save(this.currentStateForSave());
      this.emit({ lastSavedAt: Date.now() });
    } catch (error) {
      this.dirty = this.dirty || wasDirty;
      console.error('Failed to save game', error);
    }
  }
}
