'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { toast } from 'sonner';

import { PRISM_CORE_PROGRAM_ID } from '@/app/lib/constants';
import { getConfigPda, getVaultPda } from '@/app/lib/pda';

// SHA256("global:reactivate_vault")[0..8] — from anchor build IDL
const DISC = Buffer.from([245, 50, 143, 70, 114, 220, 25, 251]);

export function useReactivateVault(vaultId: number) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey || !wallet.signTransaction) throw new Error('Connect wallet');

      const [config] = getConfigPda();
      const [vault] = getVaultPda(vaultId);

      const ix = new TransactionInstruction({
        programId: PRISM_CORE_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: config, isSigner: false, isWritable: false },
          { pubkey: vault, isSigner: false, isWritable: true },
        ],
        data: DISC,
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;

      const signedTx = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
    },
    onSuccess: () => {
      toast.success(`Vault #${vaultId} reactivated`);
      queryClient.invalidateQueries({ queryKey: ['vault-state'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Reactivation failed');
    },
  });
}
