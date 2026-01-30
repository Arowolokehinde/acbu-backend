/**
 * ReserveTracker tests. No mock data.
 * Integration-style: uses real prisma and real fintech router when env is set; skips when not.
 * Basket: uses BasketService (DB); tests assert 10-currency basket and weight sum.
 */
import { ReserveTracker } from './ReserveTracker';
import { basketService } from '../basket';

const hasDbEnv = Boolean(process.env.DATABASE_URL);

const EXPECTED_CURRENCIES = ['NGN', 'ZAR', 'KES', 'RWF', 'EGP', 'GHS', 'XOF', 'MAD', 'TZS', 'UGX'];

describe('ReserveTracker', () => {
  const reserveTracker = new ReserveTracker();

  describe('basket config', () => {
    it('uses 10-currency basket', async () => {
      const basket = await basketService.getCurrentBasket();
      expect(basket).toHaveLength(10);
      const currencies = basket.map((e) => e.currency);
      for (const c of EXPECTED_CURRENCIES) {
        expect(currencies).toContain(c);
      }
    });

    it('basket weights sum to 100', async () => {
      const basket = await basketService.getCurrentBasket();
      const sum = basket.reduce((a, e) => a + e.weight, 0);
      expect(sum).toBe(100);
    });
  });

  describe('getReserveStatus', () => {
    it('returns shape with totalAcbuSupply, totalReserveValueUsd, overcollateralizationRatio, health, currencies', async () => {
      if (!hasDbEnv) {
        return; // skip when no DB
      }
      const status = await reserveTracker.getReserveStatus();
      expect(status).toHaveProperty('totalAcbuSupply');
      expect(status).toHaveProperty('totalReserveValueUsd');
      expect(status).toHaveProperty('overcollateralizationRatio');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('currencies');
      expect(['healthy', 'warning', 'critical']).toContain(status.health);
      expect(Array.isArray(status.currencies)).toBe(true);
    }, 15000);
  });

  describe('calculateReserveRatio', () => {
    it('returns a non-negative number or zero', async () => {
      if (!hasDbEnv) {
        return;
      }
      const ratio = await reserveTracker.calculateReserveRatio();
      expect(ratio).toBeGreaterThanOrEqual(0);
    }, 10000);
  });
});
