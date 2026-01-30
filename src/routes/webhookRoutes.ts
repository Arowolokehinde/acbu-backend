import { Router } from 'express';
import { handleFlutterwaveWebhook, verifyFlutterwaveSignature } from '../controllers/webhookController';

const router = Router();
// Raw body and parsed body are set by middleware in index.ts for /v1/webhooks
router.post('/flutterwave', verifyFlutterwaveSignature, handleFlutterwaveWebhook);

export default router;
