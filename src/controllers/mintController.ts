/**
 * POST /v1/mint/usdc - Mint ACBU from USDC deposit.
 * Creates transaction record; invokes minting contract when configured.
 */
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { getContractAddresses } from '../config/contracts';
import { mintingService } from '../services/contracts';
import { AuthRequest } from '../middleware/auth';
import { Decimal } from '@prisma/client/runtime/library';
import { logAudit } from '../services/audit';

const MINT_FEE_BPS = 30; // 0.3%
const DECIMALS_7 = 1e7;

const bodySchema = z.object({
  usdc_amount: z.string().min(1).refine((s) => !Number.isNaN(Number(s)) && Number(s) > 0, 'must be positive'),
  wallet_address: z.string().length(56).regex(/^G/),
  currency_preference: z.enum(['auto']).optional(),
});

export async function mintFromUsdc(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const { usdc_amount, wallet_address } = parsed.data;
    const usdcNum = Number(usdc_amount);
    const feeUsdc = (usdcNum * MINT_FEE_BPS) / 10000;
    const usdcAmount7 = Math.round(usdcNum * DECIMALS_7).toString();

    const tx = await prisma.transaction.create({
      data: {
        userId: req.apiKey?.userId ?? undefined,
        type: 'mint',
        status: 'pending',
        usdcAmount: new Decimal(usdcNum),
        fee: new Decimal(feeUsdc),
        rateSnapshot: { acbu_usd: null, timestamp: new Date().toISOString() },
      },
    });
    await logAudit({
      eventType: 'transaction',
      entityType: 'transaction',
      entityId: tx.id,
      action: 'mint_created',
      newValue: { type: 'mint', usdcAmount: usdcNum, wallet_address: wallet_address ? '***' : undefined },
      performedBy: req.apiKey?.userId ?? undefined,
    });

    const addresses = getContractAddresses();
    if (addresses.minting) {
      try {
        const result = await mintingService.mintFromUsdc({
          usdcAmount: usdcAmount7,
          recipient: wallet_address,
        });
        const acbuNum = Number(result.acbuAmount) / DECIMALS_7;
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            status: 'completed',
            acbuAmount: new Decimal(acbuNum),
            blockchainTxHash: result.transactionHash,
            completedAt: new Date(),
          },
        });
        res.status(200).json({
          transaction_id: tx.id,
          acbu_amount: String(acbuNum),
          usdc_amount: String(usdcNum),
          fee: String(feeUsdc),
          rate: { acbu_usd: null, timestamp: new Date().toISOString() },
          status: 'completed',
          estimated_completion: new Date().toISOString(),
          blockchain_tx_hash: result.transactionHash,
        });
        return;
      } catch (err) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'failed' },
        });
        next(err);
        return;
      }
    }

    res.status(200).json({
      transaction_id: tx.id,
      acbu_amount: null,
      usdc_amount: String(usdcNum),
      fee: String(feeUsdc),
      rate: { acbu_usd: null, timestamp: new Date().toISOString() },
      status: 'pending',
      estimated_completion: null,
    });
  } catch (error) {
    next(error);
  }
}
