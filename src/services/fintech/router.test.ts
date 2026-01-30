/**
 * FintechProviderRouter tests. No mock data; we only assert routing (which provider is returned per currency).
 * Providers used are real implementations or stubs that throw—no fake balances/rates.
 */
import { FintechProviderRouter } from './router';
import type { FintechProvider, FintechProviderId } from './types';

/** Stub that throws if called; used to assert routing only. No mock data. */
const throwingStub: FintechProvider = {
  getBalance: async () => {
    throw new Error('Use real env for balance');
  },
  convertCurrency: async () => {
    throw new Error('Use real env for FX');
  },
  disburseFunds: async () => {
    throw new Error('Use real env for disbursement');
  },
};

describe('FintechProviderRouter', () => {
  const defaultMap: Record<string, FintechProviderId> = {
    NGN: 'paystack',
    KES: 'flutterwave',
    RWF: 'mtn_momo',
    ZAR: 'flutterwave',
    GHS: 'flutterwave',
    EGP: 'flutterwave',
    MAD: 'flutterwave',
    TZS: 'flutterwave',
    UGX: 'flutterwave',
    XOF: 'flutterwave',
  };

  it('returns the provider registered for each basket currency', () => {
    const router = new FintechProviderRouter(defaultMap);
    router.register('flutterwave', throwingStub);
    router.register('paystack', throwingStub);
    router.register('mtn_momo', throwingStub);

    expect(router.getProvider('NGN')).toBe(throwingStub);
    expect(router.getProvider('KES')).toBe(throwingStub);
    expect(router.getProvider('RWF')).toBe(throwingStub);
    expect(router.getProvider('ZAR')).toBe(throwingStub);
    expect(router.getProvider('GHS')).toBe(throwingStub);
    expect(router.getProvider('EGP')).toBe(throwingStub);
    expect(router.getProvider('MAD')).toBe(throwingStub);
    expect(router.getProvider('TZS')).toBe(throwingStub);
    expect(router.getProvider('UGX')).toBe(throwingStub);
    expect(router.getProvider('XOF')).toBe(throwingStub);
  });

  it('falls back to flutterwave when mapped provider is not registered', () => {
    const router = new FintechProviderRouter(defaultMap);
    router.register('flutterwave', throwingStub);

    expect(router.getProvider('NGN')).toBe(throwingStub);
  });

  it('throws when currency has no provider and flutterwave not registered', () => {
    const router = new FintechProviderRouter({ XYZ: 'flutterwave' });

    expect(() => router.getProvider('XYZ')).toThrow(
      /No fintech provider for currency XYZ; flutterwave not registered/
    );
  });

  it('getProviderById returns registered provider', () => {
    const router = new FintechProviderRouter(defaultMap);
    router.register('flutterwave', throwingStub);

    expect(router.getProviderById('flutterwave')).toBe(throwingStub);
  });

  it('getProviderById throws when provider not registered', () => {
    const router = new FintechProviderRouter(defaultMap);

    expect(() => router.getProviderById('paystack')).toThrow(
      /Fintech provider paystack not registered/
    );
  });

  it('uses custom currency map when provided', () => {
    const router = new FintechProviderRouter({ NGN: 'flutterwave', KES: 'flutterwave' });
    router.register('flutterwave', throwingStub);

    expect(router.getProvider('NGN')).toBe(throwingStub);
    expect(router.getProvider('KES')).toBe(throwingStub);
    expect(router.getProvider('UNKNOWN')).toBe(throwingStub);
  });
});
