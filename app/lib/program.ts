'use client';

import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import type { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import prismAmmIdl from '@/app/lib/idl/prism_amm.json';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';

type SignableTransaction = Transaction | VersionedTransaction;

class KeypairWallet {
  constructor(readonly payer: Keypair) {}

  get publicKey() {
    return this.payer.publicKey;
  }

  async signTransaction<T extends SignableTransaction>(transaction: T): Promise<T> {
    if ('version' in transaction) {
      transaction.sign([this.payer]);
      return transaction;
    }
    transaction.partialSign(this.payer);
    return transaction;
  }

  async signAllTransactions<T extends SignableTransaction>(transactions: T[]): Promise<T[]> {
    return Promise.all(transactions.map((transaction) => this.signTransaction(transaction)));
  }
}

export function buildProvider(connection: Connection, signer: Keypair) {
  return new AnchorProvider(connection, new KeypairWallet(signer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

export function buildPrograms(connection: Connection, signer: Keypair) {
  const provider = buildProvider(connection, signer);
  return {
    provider,
    core: new Program(prismCoreIdl as Idl, provider) as any,
    amm: new Program(prismAmmIdl as Idl, provider) as any,
  };
}
