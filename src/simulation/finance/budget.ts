/**
 * Public and personal money are separate ledgers. Nothing here ever moves money
 * between them.
 */
import { ECONOMY_CONFIG } from '../../config/game';
import type { GameState } from '../state';

export class InsufficientFundsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient public budget: need ${required}, have ${available}`);
  }
}

export function canAffordPublic(state: GameState, amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0 && state.finance.publicBudget >= amount;
}

/** Deducts from the public budget. Throws rather than allowing a negative/invalid budget. */
export function spendPublic(state: GameState, amount: number): GameState['finance'] {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount: ${amount}`);
  if (!canAffordPublic(state, amount)) {
    throw new InsufficientFundsError(amount, state.finance.publicBudget);
  }
  return {
    ...state.finance,
    publicBudget: state.finance.publicBudget - amount,
    totalPublicSpent: state.finance.totalPublicSpent + amount,
  };
}

export function payMonthlySalary(finance: GameState['finance']): GameState['finance'] {
  return { ...finance, personalBalance: finance.personalBalance + ECONOMY_CONFIG.ministerMonthlySalary };
}

export function depositAnnualBudget(finance: GameState['finance']): GameState['finance'] {
  return { ...finance, publicBudget: finance.publicBudget + ECONOMY_CONFIG.annualTransportBudget };
}
