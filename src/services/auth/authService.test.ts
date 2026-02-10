/**
 * Unit tests for authService. Mocks prisma, logger, rabbitmq, wallet, audit, jwt, and auth middleware.
 */
import { mockPrisma } from '../../../tests/mocks/database';
import { mockLogger } from '../../../tests/mocks/logger';
import { QUEUES } from '../../../tests/mocks/rabbitmq';

const mockChannel = { assertQueue: jest.fn(), sendToQueue: jest.fn() };

jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/logger', () => ({ logger: mockLogger }));
jest.mock('../../config/rabbitmq', () => ({
  getRabbitMQChannel: () => mockChannel,
  QUEUES: QUEUES,
}));
jest.mock('../../middleware/auth', () => ({ generateApiKey: jest.fn().mockResolvedValue('mock-api-key') }));
jest.mock('../../utils/jwt', () => ({
  signChallengeToken: jest.fn().mockReturnValue('mock-challenge-token'),
  verifyChallengeToken: jest.fn().mockReturnValue({ userId: 'user-123' }),
}));
jest.mock('../wallet/walletService', () => ({ ensureWalletForUser: jest.fn().mockResolvedValue({ wallet_created: false }) }));
jest.mock('../audit', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

import bcrypt from 'bcryptjs';
import { signup, signin, resolveUserByIdentifier } from './authService';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('throws when username is empty or too long', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(signup({ username: '', passcode: '1234' })).rejects.toThrow('Username is required');
      await expect(signup({ username: 'a'.repeat(65), passcode: '1234' })).rejects.toThrow('at most 64 characters');
    });

    it('throws when passcode is too short or too long', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(signup({ username: 'alice', passcode: '123' })).rejects.toThrow('Passcode must be 4–64 characters');
      await expect(signup({ username: 'alice', passcode: 'a'.repeat(65) })).rejects.toThrow('Passcode must be 4–64 characters');
    });

    it('throws when username already taken', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(signup({ username: 'alice', passcode: '1234' })).rejects.toThrow('Username already taken');
    });

    it('creates user and returns user_id and message', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user-id' } as never);

      const result = await signup({ username: 'alice', passcode: 'secret123' });

      expect(result).toEqual({
        user_id: 'new-user-id',
        message: 'Account created. Sign in with your username and passcode.',
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'alice',
          stellarAddress: expect.stringMatching(/^P[a-f0-9]{55}$/),
        }),
        select: { id: true },
      });
      expect(result.user_id).toBe('new-user-id');
    });
  });

  describe('resolveUserByIdentifier', () => {
    it('queries by username when identifier has no @ or +', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', passcodeHash: 'h', twoFaMethod: null });

      await resolveUserByIdentifier('alice');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'alice' },
        select: { id: true, passcodeHash: true, twoFaMethod: true },
      });
    });

    it('queries by email when identifier contains @ and .', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await resolveUserByIdentifier('user@example.com');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: expect.any(Object),
      });
    });

    it('queries by phone when identifier is E.164', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await resolveUserByIdentifier('+250788123456');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { phoneE164: '+250788123456' },
        select: expect.any(Object),
      });
    });
  });

  describe('signin', () => {
    it('throws Invalid credentials when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(signin({ identifier: 'alice', passcode: '1234' })).rejects.toThrow('Invalid credentials');
    });

    it('throws Invalid credentials when passcode does not match', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', passcodeHash: hash, twoFaMethod: null } as never);

      await expect(signin({ identifier: 'alice', passcode: 'wrong' })).rejects.toThrow('Invalid credentials');
    });

    it('returns api_key and user_id when no 2FA', async () => {
      const hash = await bcrypt.hash('secret123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', passcodeHash: hash, twoFaMethod: null } as never);

      const result = await signin({ identifier: 'alice', passcode: 'secret123' });

      expect('requires_2fa' in result ? result.requires_2fa : false).toBe(false);
      expect(result).toMatchObject({ api_key: 'mock-api-key', user_id: 'u1' });
    });
  });
});
