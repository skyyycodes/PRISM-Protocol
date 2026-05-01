'use client';

import { useCallback, useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, type Connection } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { PrismCore } from '@/app/lib/idl/prism_core';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';
import { PRISM_CORE_PROGRAM_ID } from '@/app/lib/constants';
import { getConfigPda, getIkaCollateralPda, getLoanPda, getVaultPda } from '@/app/lib/pda';
import {
  buildVerifyCollateralTx,
  IkaDwalletInfo,
  IkaChain,
  pollOracleAttestation,
} from '@/app/lib/ika';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IkaCollateralState {
  loan: PublicKey;
  dwalletId: Uint8Array;
  chainId: number;
  collateralAmountUsd: bigint;
  status: 'Pending' | 'Locked' | 'Released' | 'Liquidated';
  oraclePubkey: PublicKey;
  lockedTs: number;
  bump: number;
}

type FetchableAccount<T = any> = {
  fetch(address: PublicKey): Promise<T>;
  fetchNullable(address: PublicKey): Promise<T | null>;
};

type PrismCoreProgram = Program<PrismCore> & {
  account: {
    ikaCollateral: FetchableAccount;
    loan: FetchableAccount;
  };
};

function buildPrismCoreProgram(
  connection: Connection,
  wallet: NonNullable<ReturnType<typeof useAnchorWallet>>,
): PrismCoreProgram {
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  return new Program<PrismCore>(prismCoreIdl as PrismCore, provider) as PrismCoreProgram;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read: fetch IkaCollateral PDA state
// ─────────────────────────────────────────────────────────────────────────────

export function useIkaCollateralAccount(loanPubkey: PublicKey | null) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: ['ika-collateral', loanPubkey?.toBase58()],
    enabled: !!loanPubkey && !!wallet,
    queryFn: async (): Promise<IkaCollateralState | null> => {
      if (!loanPubkey || !wallet) return null;
      const program = buildPrismCoreProgram(connection, wallet);
      const [pda] = getIkaCollateralPda(loanPubkey);
      try {
        const acc = await program.account.ikaCollateral.fetch(pda);
        return {
          loan: acc.loan,
          dwalletId: new Uint8Array(acc.dwalletId),
          chainId: acc.chainId,
          collateralAmountUsd: BigInt(acc.collateralAmountUsd.toString()),
          status: Object.keys(acc.status)[0] as IkaCollateralState['status'],
          oraclePubkey: acc.oraclePubkey,
          lockedTs: acc.lockedTs.toNumber(),
          bump: acc.bump,
        };
      } catch {
        return null; // account does not exist yet
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

interface AttachParams {
  vaultId: number;
  loanId: number;
  dwallet: IkaDwalletInfo;
  chainId: IkaChain;
  collateralAmountUsd: bigint;
  oraclePubkey: PublicKey;
}

export function useAttachIkaCollateral() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: AttachParams) => {
      if (!wallet) throw new Error('Wallet not connected');
      const program = buildPrismCoreProgram(connection, wallet);

      const [vaultPda] = getVaultPda(params.vaultId);
      const [loanPda] = getLoanPda(vaultPda, params.loanId);
      const [ikaCollateralPda] = getIkaCollateralPda(loanPda);

      await program.methods
        .attachIkaCollateral(
          Array.from(params.dwallet.dwalletId) as unknown as number[],
          params.chainId,
          new BN(params.collateralAmountUsd.toString()),
          params.oraclePubkey,
        )
        .accounts({
          borrower: wallet.publicKey,
          loan: loanPda,
          ikaCollateral: ikaCollateralPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      return loanPda;
    },
    onSuccess: (loanPda) => {
      qc.invalidateQueries({ queryKey: ['ika-collateral', loanPda.toBase58()] });
      toast.success('IKA collateral registered (Pending oracle verification)');
    },
    onError: (e: Error) => toast.error(`Attach failed: ${e.message}`),
  });
}

interface VerifyParams {
  vaultId: number;
  loanId: number;
}

export function useVerifyIkaCollateral() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const qc = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const verify = useCallback(
    async (params: VerifyParams & { dwalletId: Uint8Array; chainId: IkaChain }) => {
      if (!wallet) throw new Error('Wallet not connected');
      const program = buildPrismCoreProgram(connection, wallet);

      const [vaultPda] = getVaultPda(params.vaultId);
      const [loanPda] = getLoanPda(vaultPda, params.loanId);
      const [configPda] = getConfigPda();

      // Poll IKA oracle until attestation is ready.
      setIsPolling(true);
      toast('Waiting for IKA oracle attestation…', { duration: 8000 });
      const attestation = await pollOracleAttestation(
        params.dwalletId,
        params.chainId,
        loanPda,
      );
      setIsPolling(false);

      // Build the ed25519 + verify_ika_collateral transaction.
      const tx = await buildVerifyCollateralTx(program, attestation, configPda);

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      qc.invalidateQueries({ queryKey: ['ika-collateral', loanPda.toBase58()] });
      return sig;
    },
    [connection, wallet, qc],
  );

  return { verify, isPolling };
}

// ─────────────────────────────────────────────────────────────────────────────
// Read: fetch Loan account state (for gating release)
// ─────────────────────────────────────────────────────────────────────────────

export function useLoanAccount(loanPubkey: PublicKey | null) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: ['loan-account', loanPubkey?.toBase58()],
    enabled: !!loanPubkey && !!wallet,
    refetchInterval: 5_000,
    queryFn: async () => {
      if (!loanPubkey || !wallet) return null;
      const program = buildPrismCoreProgram(connection, wallet);
      return program.account.loan.fetchNullable(loanPubkey);
    },
  });
}

interface ReleaseParams {
  vaultId: number;
  loanId: number;
}

export function useReleaseIkaCollateral() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReleaseParams) => {
      if (!wallet) throw new Error('Wallet not connected');
      const program = buildPrismCoreProgram(connection, wallet);

      const [vaultPda] = getVaultPda(params.vaultId);
      const [loanPda] = getLoanPda(vaultPda, params.loanId);
      const [ikaCollateralPda] = getIkaCollateralPda(loanPda);

      await program.methods
        .releaseIkaCollateral()
        .accounts({
          signer: wallet.publicKey,
          loan: loanPda,
          ikaCollateral: ikaCollateralPda,
        })
        .rpc({ commitment: 'confirmed' });

      return loanPda;
    },
    onSuccess: (loanPda) => {
      qc.invalidateQueries({ queryKey: ['ika-collateral', loanPda.toBase58()] });
      toast.success('Collateral released — IKA Network will unlock your BTC/ETH');
    },
    onError: (e: Error) => toast.error(`Release failed: ${e.message}`),
  });
}
