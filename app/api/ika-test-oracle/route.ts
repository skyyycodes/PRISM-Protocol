/**
 * Local test oracle for IKA collateral verification.
 *
 * Simulates the IKA oracle by signing the 81-byte attestation message with a
 * fixed devnet test keypair.  Use this during development before the real IKA
 * oracle endpoint is live.
 *
 * Setup:
 *   Set NEXT_PUBLIC_IKA_ORACLE_URL=http://localhost:3000/api/ika-test-oracle in .env.local
 *   When attaching collateral in the UI, use TEST_ORACLE_PUBKEY as the oracle public key.
 *
 * Production:
 *   Change NEXT_PUBLIC_IKA_ORACLE_URL to the real IKA oracle and remove this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Fixed 32-byte seed for the test oracle keypair.
// Solana base58 pubkey: SBEJ7epASX4irgiMqL5uVTunT8YpTZW7bLpRYdHpS4G
const TEST_SEED = Buffer.from(
  'fc0dfc6881aee8d6af913f60fff07ab0b1ec16427573ab6d33b3825df3a52820',
  'hex',
);

const oracleKeypair = Ed25519Keypair.fromSecretKey(TEST_SEED);
const oraclePublicKey = new PublicKey(oracleKeypair.getPublicKey().toRawBytes());

export const TEST_ORACLE_PUBKEY = oraclePublicKey.toBase58();

// Fixed collateral amount returned by the test oracle: $50,000 USD
const TEST_COLLATERAL_USD_MICRO = 50_000_000_000n;

function buildMessage(
  dwalletIdHex: string,
  chainId: number,
  amountUsdMicro: bigint,
  loanPubkeyB58: string,
): Buffer {
  const buf = Buffer.alloc(81);
  Buffer.from('ika_atts').copy(buf, 0);
  Buffer.from(dwalletIdHex, 'hex').copy(buf, 8);
  buf.writeUInt8(chainId, 40);
  buf.writeBigUInt64LE(amountUsdMicro, 41);
  new PublicKey(loanPubkeyB58).toBuffer().copy(buf, 49);
  return buf;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 });

  const { dwallet_id, chain_id, loan_pubkey } = body as {
    dwallet_id: string;
    chain_id: number;
    loan_pubkey: string;
  };

  if (!dwallet_id || chain_id === undefined || !loan_pubkey) {
    return NextResponse.json({ error: 'missing: dwallet_id, chain_id, loan_pubkey' }, { status: 400 });
  }
  if (dwallet_id.length !== 64) {
    return NextResponse.json({ error: 'dwallet_id must be 64 hex chars (32 bytes)' }, { status: 400 });
  }

  const message = buildMessage(dwallet_id, chain_id, TEST_COLLATERAL_USD_MICRO, loan_pubkey);
  const signature = await oracleKeypair.sign(message);

  return NextResponse.json({
    signature: Buffer.from(signature).toString('hex'),
    oracle_pubkey: oraclePublicKey.toBase58(),
    amount_usd_micro: TEST_COLLATERAL_USD_MICRO.toString(),
  });
}
