import { Server, TransactionBuilder, Operation, xdr } from 'stellar-sdk';
import { stellarClient } from './client';
import { logger } from '../../config/logger';

export interface ContractCallOptions {
  contractId: string;
  functionName: string;
  args: xdr.ScVal[];
  sourceAccount: string;
  fee?: string;
}

export interface ContractInvokeResult {
  transactionHash: string;
  result: xdr.ScVal;
  ledger: number;
}

export class ContractClient {
  private server: Server;
  private networkPassphrase: string;

  constructor() {
    this.server = stellarClient.getServer();
    this.networkPassphrase = stellarClient.getNetworkPassphrase();
  }

  /**
   * Invoke a contract function
   */
  async invokeContract(options: ContractCallOptions): Promise<ContractInvokeResult> {
    try {
      const { contractId, functionName, args, sourceAccount, fee } = options;

      logger.info('Invoking contract function', {
        contractId,
        functionName,
        sourceAccount,
      });

      // Build invoke contract operation
      const invokeOp = Operation.invokeHostFunction({
        function: xdr.HostFunction.hostFunctionTypeInvokeContract,
        parameters: [
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeContract(
              xdr.ContractId.fromXdr(contractId)
            )
          ),
          xdr.ScVal.scvSymbol(functionName),
          ...args,
        ],
      });

      // Build transaction
      const sourceAccountObj = await stellarClient.getAccount(sourceAccount);
      const builder = new TransactionBuilder(sourceAccountObj, {
        fee: fee || '100',
        networkPassphrase: this.networkPassphrase,
      });

      builder.addOperation(invokeOp);
      const transaction = builder.build();

      // Sign transaction (if keypair is available)
      const keypair = stellarClient.getKeypair();
      if (keypair) {
        transaction.sign(keypair);
      }

      // Submit transaction
      const result = await stellarClient.submitTransaction(transaction);

      // Parse result from transaction
      const resultXdr = this.parseTransactionResult(result);

      return {
        transactionHash: result.hash,
        result: resultXdr,
        ledger: result.ledger || 0,
      };
    } catch (error) {
      logger.error('Failed to invoke contract', {
        contractId: options.contractId,
        functionName: options.functionName,
        error,
      });
      throw error;
    }
  }

  /**
   * Read contract data (simulate call without submitting)
   */
  async readContract(
    contractId: string,
    functionName: string,
    args: xdr.ScVal[]
  ): Promise<xdr.ScVal> {
    try {
      logger.info('Reading contract data', { contractId, functionName });

      // For read operations, we can use simulateTransaction
      // This is a simplified version - in production, use proper simulation
      const sourceAccount = stellarClient.getKeypair()?.publicKey();
      if (!sourceAccount) {
        throw new Error('No source account available for contract read');
      }

      // Build invoke operation
      const invokeOp = Operation.invokeHostFunction({
        function: xdr.HostFunction.hostFunctionTypeInvokeContract,
        parameters: [
          xdr.ScVal.scvAddress(
            xdr.ScAddress.scAddressTypeContract(
              xdr.ContractId.fromXdr(contractId)
            )
          ),
          xdr.ScVal.scvSymbol(functionName),
          ...args,
        ],
      });

      const sourceAccountObj = await stellarClient.getAccount(sourceAccount);
      const builder = new TransactionBuilder(sourceAccountObj, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      });

      builder.addOperation(invokeOp);
      const transaction = builder.build();

      // Simulate transaction (read-only)
      const simulation = await this.server.simulateTransaction(transaction);

      if (simulation.error) {
        throw new Error(`Simulation error: ${simulation.error}`);
      }

      // Parse result
      return this.parseSimulationResult(simulation);
    } catch (error) {
      logger.error('Failed to read contract', {
        contractId,
        functionName,
        error,
      });
      throw error;
    }
  }

  /**
   * Parse transaction result
   */
  private parseTransactionResult(result: any): xdr.ScVal {
    // Extract result from transaction result
    // This is a simplified version - actual implementation depends on transaction structure
    try {
      if (result.result_xdr) {
        const txResult = xdr.TransactionResult.fromXDR(result.result_xdr, 'base64');
        const operations = txResult.result().results();
        if (operations.length > 0) {
          const opResult = operations[0].tr().invokeHostFunctionResult();
          if (opResult) {
            return opResult.success().returnValue();
          }
        }
      }
      throw new Error('Could not parse transaction result');
    } catch (error) {
      logger.error('Failed to parse transaction result', { error });
      throw error;
    }
  }

  /**
   * Parse simulation result
   */
  private parseSimulationResult(simulation: any): xdr.ScVal {
    try {
      if (simulation.result) {
        return simulation.result.returnValue;
      }
      throw new Error('Could not parse simulation result');
    } catch (error) {
      logger.error('Failed to parse simulation result', { error });
      throw error;
    }
  }

  /**
   * Convert JavaScript value to ScVal
   */
  static toScVal(value: any): xdr.ScVal {
    if (typeof value === 'string') {
      return xdr.ScVal.scvString(value);
    } else if (typeof value === 'number') {
      return xdr.ScVal.scvI128(
        xdr.Int128Parts({
          hi: xdr.Int64.fromString(Math.floor(value / 2 ** 64).toString()),
          lo: xdr.Uint64.fromString((value % 2 ** 64).toString()),
        })
      );
    } else if (typeof value === 'boolean') {
      return xdr.ScVal.scvBool(value);
    } else if (value instanceof Uint8Array) {
      return xdr.ScVal.scvBytes(value);
    } else if (Array.isArray(value)) {
      const vec = value.map((v) => ContractClient.toScVal(v));
      return xdr.ScVal.scvVec(vec);
    } else {
      throw new Error(`Unsupported value type: ${typeof value}`);
    }
  }

  /**
   * Convert ScVal to JavaScript value
   */
  static fromScVal(scVal: xdr.ScVal): any {
    switch (scVal.switch()) {
      case xdr.ScValType.scvBool():
        return scVal.b();
      case xdr.ScValType.scvVoid():
        return null;
      case xdr.ScValType.scvU32():
        return scVal.u32();
      case xdr.ScValType.scvI32():
        return scVal.i32();
      case xdr.ScValType.scvU64():
        return scVal.u64().toString();
      case xdr.ScValType.scvI64():
        return scVal.i64().toString();
      case xdr.ScValType.scvU128():
        return scVal.u128().toString();
      case xdr.ScValType.scvI128():
        const parts = scVal.i128();
        return BigInt(parts.hi().toString()) * BigInt(2 ** 64) + BigInt(parts.lo().toString());
      case xdr.ScValType.scvString():
        return scVal.str().toString();
      case xdr.ScValType.scvBytes():
        return scVal.bytes();
      case xdr.ScValType.scvVec():
        return scVal.vec().map((v) => ContractClient.fromScVal(v));
      default:
        throw new Error(`Unsupported ScVal type: ${scVal.switch()}`);
    }
  }
}

export const contractClient = new ContractClient();
