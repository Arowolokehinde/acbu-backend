import { Router } from 'express';
import { mintFromUsdc } from '../controllers/mintController';
import { validateApiKey } from '../middleware/auth';
import { apiKeyRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);
router.post('/usdc', mintFromUsdc);
export default router;
