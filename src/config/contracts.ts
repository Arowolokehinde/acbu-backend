import { config } from './env';

export interface ContractAddresses {
  oracle: string;
  reserveTracker: string;
  minting: string;
  burning: string;
}

/**
 * Get contract addresses from environment variables
 * These should be set after contract deployment
 */
export const getContractAddresses = (): ContractAddresses => {
  const network = config.stellar.network;

  // Try to load from environment variables first
  const addresses: ContractAddresses = {
    oracle: process.env[`CONTRACT_ORACLE_${network.toUpperCase()}`] || '',
    reserveTracker:
      process.env[`CONTRACT_RESERVE_TRACKER_${network.toUpperCase()}`] || '',
    minting: process.env[`CONTRACT_MINTING_${network.toUpperCase()}`] || '',
    burning: process.env[`CONTRACT_BURNING_${network.toUpperCase()}`] || '',
  };

  // Fallback to generic environment variables
  if (!addresses.oracle) {
    addresses.oracle = process.env.CONTRACT_ORACLE || '';
  }
  if (!addresses.reserveTracker) {
    addresses.reserveTracker = process.env.CONTRACT_RESERVE_TRACKER || '';
  }
  if (!addresses.minting) {
    addresses.minting = process.env.CONTRACT_MINTING || '';
  }
  if (!addresses.burning) {
    addresses.burning = process.env.CONTRACT_BURNING || '';
  }

  return addresses;
};

/**
 * Contract addresses configuration
 */
export const contractAddresses = getContractAddresses();

/**
 * Validate that all contract addresses are set
 */
export const validateContractAddresses = (): void => {
  const addresses = contractAddresses;
  const missing: string[] = [];

  if (!addresses.oracle) missing.push('oracle');
  if (!addresses.reserveTracker) missing.push('reserveTracker');
  if (!addresses.minting) missing.push('minting');
  if (!addresses.burning) missing.push('burning');

  if (missing.length > 0) {
    throw new Error(
      `Missing contract addresses: ${missing.join(', ')}. Please set the CONTRACT_* environment variables.`
    );
  }
};
