import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { logger } from './config/logger';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { connectRabbitMQ, disconnectRabbitMQ } from './config/rabbitmq';
import { corsMiddleware } from './middleware/cors';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { standardRateLimiter } from './middleware/rateLimiter';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import webhookRoutes from './routes/webhookRoutes';

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(corsMiddleware);
app.use(express.urlencoded({ extended: true }));

// Webhooks need raw body for signature verification; mount before json()
app.use(
  `/${config.apiVersion}/webhooks`,
  express.raw({ type: 'application/json' }),
  (req: express.Request, _res, next) => {
    const raw = req.body as Buffer;
    (req as unknown as { rawBody: Buffer }).rawBody = raw;
    try {
      (req as unknown as { body: unknown }).body = JSON.parse(raw.toString());
    } catch {
      (req as unknown as { body: unknown }).body = {};
    }
    next();
  },
  webhookRoutes
);
app.use(express.json());

// Logging
app.use(requestLogger);

// Rate limiting
app.use(standardRateLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use(`/${config.apiVersion}`, routes);

// Error handling (must be last)
app.use(errorHandler);

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectMongoDB();
    logger.info('MongoDB connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    // Start KYC processing consumer
    const { startKycProcessingConsumer } = await import('./jobs/kycProcessingJob');
    await startKycProcessingConsumer();

    // Start wallet activation consumer (send XLM when KYC fee paid)
    const { startWalletActivationConsumer } = await import('./jobs/walletActivationJob');
    await startWalletActivationConsumer();

    // Start notification consumer (OTP_SEND + NOTIFICATIONS → email/SMS)
    const { startNotificationConsumer } = await import('./jobs/notificationConsumer');
    await startNotificationConsumer();

    // Start outbound webhook consumer (WEBHOOKS → deliver with HMAC-SHA256)
    const { startWebhookConsumer } = await import('./jobs/webhookConsumer');
    await startWebhookConsumer();

    // Start oracle update scheduler (every 6h)
    const { startOracleUpdateScheduler } = await import('./jobs/oracleUpdateJob');
    await startOracleUpdateScheduler();

    // Start reserve tracking scheduler (every 6h)
    const { startReserveTrackingScheduler } = await import('./jobs/reserveTrackingJob');
    await startReserveTrackingScheduler();

    // Start daily rebalancing scheduler (00:00 UTC)
    const { startRebalancingScheduler } = await import('./jobs/rebalancingJob');
    await startRebalancingScheduler();

    // Start proposed basket weights scheduler (metrics → proposed weights, e.g. monthly)
    const { startProposedWeightsScheduler } = await import('./jobs/proposedWeightsJob');
    await startProposedWeightsScheduler();

    // Start USDC conversion consumer (MintEvent → basket allocation)
    const { startUsdcConversionConsumer } = await import('./jobs/usdcConversionJob');
    await startUsdcConversionConsumer();

    // Start withdrawal processing consumer (BurnEvent → fintech disbursement)
    const { startWithdrawalProcessingConsumer } = await import('./jobs/withdrawalProcessingJob');
    await startWithdrawalProcessingConsumer();

    // Register MintEvent/BurnEvent handlers and start Stellar event listener (runs in background)
    const { startMintEventListener } = await import('./jobs/mintEventListener');
    await startMintEventListener();
    const { startBurnEventListener } = await import('./jobs/burnEventListener');
    await startBurnEventListener();
    const { eventListener } = await import('./services/stellar/eventListener');
    void eventListener.start();

    // Start HTTP server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API Documentation: http://localhost:${config.port}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await disconnectMongoDB();
  await disconnectRabbitMQ();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

export default app;
