import { contractAddresses } from '../../config/contracts';
import { MintingService } from './minting.Service';
import { BurningService } from './burning.Service';
import { OracleService } from './oracle.Service';
import { ReserveTrackerService } from './reserveTracker.Service';

/**
 * Initialize contract services with deployed contract addresses
 */
export const mintingService = new MintingService(contractAddresses.minting);
export const burningService = new BurningService(contractAddresses.burning);
export const oracleService = new OracleService(contractAddresses.oracle);
export const reserveTrackerService = new ReserveTrackerService(
  contractAddresses.reserveTracker
);

export * from './minting.Service';
export * from './burning.Service';
export * from './oracle.Service';
export * from './reserveTracker.Service';
