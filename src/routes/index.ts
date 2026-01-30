import { Router } from 'express';
import { config } from '../config/env';
import reserveRoutes from './reserveRoutes';
import kycRoutes from './kycRoutes';
import recipientRoutes from './recipientRoutes';
import transferRoutes from './transferRoutes';
import userRoutes from './userRoutes';
import recoveryRoutes from './recoveryRoutes';
import authRoutes from './authRoutes';
import webhookRoutes from './webhookRoutes';
import mintRoutes from './mintRoutes';
import burnRoutes from './burnRoutes';
import ratesRoutes from './ratesRoutes';
import transactionRoutes from './transactionRoutes';

const router: ReturnType<typeof Router> = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.apiVersion,
  });
});

// Extended health / metrics (reserve ratio when available; for monitoring dashboards)
router.get('/health/metrics', async (_req, res) => {
  try {
    const { reserveTracker } = await import('../services/reserve/ReserveTracker');
    const ratio = await reserveTracker.calculateReserveRatio();
    const status = await reserveTracker.getReserveStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      reserveRatio: ratio,
      overcollateralizationRatio: status.overcollateralizationRatio,
      reserveHealth: status.health,
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
    });
  }
});

// API routes
router.use('/auth', authRoutes);
router.use('/reserves', reserveRoutes);
router.use('/kyc', kycRoutes);
router.use('/recipient', recipientRoutes);
router.use('/transfers', transferRoutes);
router.use('/users', userRoutes);
router.use('/recovery', recoveryRoutes);
router.use('/mint', mintRoutes);
router.use('/burn', burnRoutes);
router.use('/rates', ratesRoutes);
router.use('/transactions', transactionRoutes);

export default router;
