/**
 * Reserve controller tests. No mock data.
 * Uses real reserveTracker; skips when DATABASE_URL is not set.
 */
import { Request, Response, NextFunction } from 'express';
import { getReserveStatus, trackReserves } from './reserveController';
import { reserveTracker } from '../services/reserve/ReserveTracker';

const hasDbEnv = Boolean(process.env.DATABASE_URL);

describe('reserveController', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('getReserveStatus', () => {
    it('calls reserveTracker.getReserveStatus and returns JSON with expected keys', async () => {
      if (!hasDbEnv) {
        return;
      }
      const getReserveStatusSpy = jest.spyOn(reserveTracker, 'getReserveStatus');

      await getReserveStatus(
        {} as Request,
        res as Response,
        next
      );

      expect(getReserveStatusSpy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      expect(payload).toHaveProperty('totalAcbuSupply');
      expect(payload).toHaveProperty('totalReserveValueUsd');
      expect(payload).toHaveProperty('overcollateralizationRatio');
      expect(payload).toHaveProperty('health');
      expect(payload).toHaveProperty('currencies');

      getReserveStatusSpy.mockRestore();
    }, 15000);

    it('calls next(error) when getReserveStatus throws', async () => {
      const getReserveStatusSpy = jest
        .spyOn(reserveTracker, 'getReserveStatus')
        .mockRejectedValueOnce(new Error('DB unavailable'));

      await getReserveStatus({} as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      getReserveStatusSpy.mockRestore();
    });
  });

  describe('trackReserves', () => {
    it('calls reserveTracker.trackReserves and returns completion message', async () => {
      if (!hasDbEnv) {
        return;
      }
      const trackSpy = jest.spyOn(reserveTracker, 'trackReserves');

      await trackReserves({} as Request, res as Response, next);

      expect(trackSpy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Reserve tracking completed' });

      trackSpy.mockRestore();
    }, 30000);

    it('calls next(error) when trackReserves throws', async () => {
      const trackSpy = jest
        .spyOn(reserveTracker, 'trackReserves')
        .mockRejectedValueOnce(new Error('Tracking failed'));

      await trackReserves({} as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      trackSpy.mockRestore();
    });
  });
});
