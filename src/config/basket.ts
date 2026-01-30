/**
 * ACBU 10-currency basket definition (Stage 3B per MVP_PHASE.MD).
 * Used for: seed data (BasketConfig), fallback when DB has no active basket, and tests.
 * Runtime source of truth is BasketConfig in DB (stats + DAO); see BasketService.
 */

/** Currencies in weight-descending order: NGN, ZAR, KES, EGP, GHS, RWF, XOF, MAD, TZS, UGX */
export const BASKET_CURRENCIES: readonly string[] = [
  'NGN',
  'ZAR',
  'KES',
  'EGP',
  'GHS',
  'RWF',
  'XOF',
  'MAD',
  'TZS',
  'UGX',
] as const;

/** Target weights (percent) per currency; sum = 100 */
export const BASKET_WEIGHTS: Record<string, number> = {
  NGN: 18,
  ZAR: 15,
  KES: 12,
  EGP: 11,
  GHS: 9,
  RWF: 8,
  XOF: 8,
  MAD: 7,
  TZS: 6,
  UGX: 6,
};

/** Type for basket currency codes */
export type BasketCurrency = (typeof BASKET_CURRENCIES)[number];

/** Sum of weights; used for validation */
export const BASKET_WEIGHTS_SUM = Object.values(BASKET_WEIGHTS).reduce(
  (a, b) => a + b,
  0
);
