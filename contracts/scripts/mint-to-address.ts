import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotent, mintTo, getMint } from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const USDC_MINT_ADDR = "CoSmAscHkm3KxFvsd3QvrLzzSX6Ke1qEfGvcWLPG1GJ1";
const ADMIN_KEY_B64 = "RvIFHRF+YvF+pdL9/0H0puQ8/lig1ji5OMj4gddty48MX/tLmXi4aXY5LsGinBJIL67g6a6nuWnMVWo0TQa7og==";

const TARGET = "2ckcepape2ocEcf3a1GKLt2HZyBgzD4iwN5UAjPBAYgN";
const AMOUNT = 10_000_000_000n; // 10,000 USDC (6 decimals)

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const usdcMint = new PublicKey(USDC_MINT_ADDR);
  const target = new PublicKey(TARGET);

  const admin = Keypair.fromSecretKey(Buffer.from(ADMIN_KEY_B64, "base64"));

  const mintInfo = await getMint(connection, usdcMint);
  if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(admin.publicKey)) {
    console.error(
      `Admin (${admin.publicKey.toBase58()}) is NOT the mint authority. ` +
        `Actual: ${mintInfo.mintAuthority?.toBase58() ?? "none"}`
    );
    process.exit(1);
  }

  const ata = await createAssociatedTokenAccountIdempotent(connection, admin, usdcMint, target);
  console.log(`ATA: ${ata.toBase58()}`);

  await mintTo(connection, admin, usdcMint, ata, admin, AMOUNT);
  console.log(`Minted ${Number(AMOUNT) / 1e6} USDC → ${TARGET}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
