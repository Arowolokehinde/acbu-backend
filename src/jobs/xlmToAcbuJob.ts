/**
 * XLM→ACBU job: processes USDC on-ramp. User swapped USDC for XLM on Stellar LP;
 * this job "sells" XLM (or uses equivalent value) and mints ACBU to the user.
 * Consumes XLM_TO_ACBU queue or polls OnRampSwap table for pending_convert.
 */
import type { ConsumeMessage } from 'amqplib';
import { connectRabbitMQ, QUEUES } from '../config/rabbitmq';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { mintFromUsdcInternal } from '../controllers/mintController';

const QUEUE = QUEUES.XLM_TO_ACBU;

import axios from 'axios';

/**
 * Fetch live XLM to USD rate.
 * Tries Binance API, then Database, then falls back to env process variables.
 */
async function getXlmUsdRate(): Promise<number> {
  try {
    const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT', { timeout: 5000 });
    if (data && data.price) {
      return parseFloat(data.price);
    }
  } catch (err: any) {
    logger.warn('Failed to fetch XLM rate from Binance', { error: err.message });
  }

  // Try DB fallback if an oracle job tracks it
  try {
    const dbRate = await prisma.oracleRate.findFirst({
      where: { currency: 'XLM' },
      orderBy: { timestamp: 'desc' },
    });
    if (dbRate && dbRate.medianRate) {
      return dbRate.medianRate.toNumber();
    }
  } catch (err) {
    logger.warn('Failed to fetch XLM rate from DB', { error: err });
  }

  // Fallback to env/default dynamically per call
  return Number(process.env.XLM_USD_RATE ?? '0.2');
}

export interface XlmToAcbuPayload {
  onRampSwapId: string;
  userId: string;
  stellarAddress: string;
  xlmAmount: string;
  usdcEquivalent?: string; // optional; if not set, computed from xlmAmount * XLM_USD_RATE
}

export async function startXlmToAcbuConsumer(): Promise<void> {
  const ch = await connectRabbitMQ();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.prefetch(1);
  ch.consume(
    QUEUE,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const body = JSON.parse(msg.content.toString()) as XlmToAcbuPayload;
        await processXlmToAcbu(body);
        ch.ack(msg);
      } catch (e) {
        logger.error('XLM→ACBU job failed', { error: e });
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  );
  logger.info('XLM→ACBU consumer started', { queue: QUEUE });
}

/**
 * Process a single on-ramp swap: sell XLM (stub) and mint ACBU to user.
 */
export async function processXlmToAcbu(payload: XlmToAcbuPayload): Promise<void> {
  const { onRampSwapId, userId, stellarAddress, xlmAmount, usdcEquivalent } = payload;
  const xlmNum = Number(xlmAmount);
  
  // Fetch live rate dynamically for this specific transaction
  const liveXlmUsdRate = await getXlmUsdRate();
  const usdcAmount = usdcEquivalent ? Number(usdcEquivalent) : xlmNum * liveXlmUsdRate;

  // OnRampSwap delegate; run npx prisma generate if types are missing
  const swap = await prisma.onRampSwap.findUnique({
    where: { id: onRampSwapId },
  });
  if (!swap || swap.status !== 'pending_convert') {
    logger.warn('OnRampSwap not found or not pending', { onRampSwapId });
    return;
  }

  await prisma.onRampSwap.update({
    where: { id: onRampSwapId },
    data: { status: 'processing' },
  });

  try {
    const { transactionId, acbuAmount } = await mintFromUsdcInternal(
      usdcAmount,
      stellarAddress,
      userId
    );
    await prisma.onRampSwap.update({
      where: { id: onRampSwapId },
      data: {
        status: 'completed',
        transactionId,
        completedAt: new Date(),
      },
    });
    logger.info('XLM→ACBU completed', {
      onRampSwapId,
      userId,
      stellarAddress,
      acbuAmount,
      transactionId,
    });
  } catch (e) {
    await prisma.onRampSwap.update({
      where: { id: onRampSwapId },
      data: { status: 'failed' },
    });
    logger.error('XLM→ACBU mint failed', { onRampSwapId, error: e });
    throw e;
  }
}

/**
 * Enqueue an on-ramp swap for processing (call when user has swapped USDC→XLM).
 */
export async function enqueueXlmToAcbu(payload: XlmToAcbuPayload): Promise<void> {
  const ch = await connectRabbitMQ();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
  logger.info('XLM→ACBU enqueued', { onRampSwapId: payload.onRampSwapId });
}
