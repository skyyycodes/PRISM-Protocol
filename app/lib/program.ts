'use client';

import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import type { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import prismAmmIdl from '@/app/lib/idl/prism_amm.json';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';

type SignableTransaction = Transaction | VersionedTransaction;

export interface AnchorWallet {
  publicKey: import('@solana/web3.js').PublicKey;
  signTransaction<T extends SignableTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends SignableTransaction>(transactions: T[]): Promise<T[]>;
}

class KeypairWallet implements AnchorWallet {
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

export function buildProvider(connection: Connection, signer?: Keypair | AnchorWallet) {
  const wallet = signer 
    ? ('signTransaction' in signer ? signer : new KeypairWallet(signer))
    : new KeypairWallet(Keypair.generate());

  return new AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed',
    preflightCommitment: 'processed',
  });
}

export function buildPrograms(connection: Connection, signer?: Keypair | AnchorWallet) {
  const provider = buildProvider(connection, signer);
  return {
    provider,
    core: new Program(prismCoreIdl as Idl, provider) as any,
    amm: new Program(prismAmmIdl as Idl, provider) as any,
  };
}
