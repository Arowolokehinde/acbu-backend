import { Router } from 'express';
import { burnAcbu } from '../controllers/burnController';
import { validateApiKey } from '../middleware/auth';
import { apiKeyRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);
router.post('/acbu', burnAcbu);
export default router;
