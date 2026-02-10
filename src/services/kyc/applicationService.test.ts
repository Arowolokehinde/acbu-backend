/**
 * Unit tests for KYC applicationService. Mocks prisma, config, rabbitmq, logger, feeVerification, validatorPool.
 */
import { mockPrisma } from '../../../tests/mocks/database';
import { mockLogger } from '../../../tests/mocks/logger';
import { mockConfig } from '../../../tests/mocks/env';

jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/logger', () => ({ logger: mockLogger }));
jest.mock('../../config/env', () => ({ config: mockConfig }));
jest.mock('../../config/rabbitmq', () => ({
  getRabbitMQChannel: jest.fn().mockReturnValue({ assertQueue: jest.fn(), sendToQueue: jest.fn() }),
  QUEUES: { KYC_PROCESSING: 'kyc_processing', WALLET_ACTIVATION: 'wallet_activation' },
}));
jest.mock('./feeVerification', () => ({
  verifyKycFeePayment: jest.fn().mockResolvedValue(true),
  verifyKycFeeViaMint: jest.fn().mockResolvedValue(true),
}));
jest.mock('./validatorPool', () => ({ assignValidators: jest.fn().mockResolvedValue(undefined) }));

import { createApplication, KYC_APPLICATION_STATUS } from './applicationService';

describe('applicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.kycApplication.create.mockResolvedValue({ id: 'app-1' } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ stellarAddress: null } as never);
  });

  describe('createApplication', () => {
    it('throws when neither fee_tx_hash nor mint_transaction_id provided', async () => {
      await expect(
        createApplication({
          userId: 'u1',
          countryCode: 'NG',
          documents: [],
        })
      ).rejects.toThrow('KYC fee source required');
    });

    it('creates application when feeTxHash provided and fee verified', async () => {
      const id = await createApplication({
        userId: 'u1',
        countryCode: 'NG',
        feeTxHash: 'tx-hash-123',
        documents: [],
      });

      expect(id).toBe('app-1');
      expect(mockPrisma.kycApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          countryCode: 'NG',
          status: KYC_APPLICATION_STATUS.PENDING,
          feeTxHash: 'tx-hash-123',
        }),
      });
    });
  });
});
