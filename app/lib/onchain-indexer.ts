import { Connection, PublicKey } from '@solana/web3.js';
import { PRISM_CORE_PROGRAM_ID } from './constants';

export type OnChainEvent = {
  signature: string;
  timestamp: number;
  success: boolean;
  eventType: string;
  signer: string;
  logs: string[];
};

export async function fetchOnChainEvents(
  connection: Connection,
  limit = 20
): Promise<OnChainEvent[]> {
  try {
    const signatures = await connection.getSignaturesForAddress(PRISM_CORE_PROGRAM_ID, { limit });
    if (signatures.length === 0) return [];

    const txs = await connection.getParsedTransactions(
      signatures.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
    );

    return txs
      .map((tx, idx) => {
        if (!tx) return null;
        const sig = signatures[idx].signature;
        const logs = tx.meta?.logMessages || [];
        const success = tx.meta?.err === null;
        const timestamp = tx.blockTime || Math.floor(Date.now() / 1000);
        const signer = tx.transaction.message.accountKeys[0].pubkey.toBase58();

        // Infer instruction name from logs
        let eventType = 'Transaction';
        for (const log of logs) {
          const match = log.match(/Program log: Instruction: (\w+)/);
          if (match) {
            eventType = match[1];
            break;
          }
        }

        return {
          signature: sig,
          timestamp,
          success,
          eventType,
          signer,
          logs
        };
      })
      .filter((e): e is OnChainEvent => e !== null);
  } catch (err) {
    console.error('Failed to fetch on-chain events:', err);
    return [];
  }
}
