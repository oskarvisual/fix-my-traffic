/**
 * Deterministic pseudo-random utilities. Every random decision in the
 * simulation must come from here so runs are reproducible from a seed.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG step: returns [value in [0,1), nextState]. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Stateful convenience wrapper. Use `state` to persist and resume. */
export class SeededRandom {
  constructor(public state: number) {}

  next(): number {
    const [value, next] = nextRandom(this.state);
    this.state = next;
    return value;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

/** Stateless deterministic value in [0,1) for a key under a seed. */
export function randomFor(seed: number, key: string): number {
  return nextRandom((seed ^ hashString(key)) >>> 0)[0];
}
