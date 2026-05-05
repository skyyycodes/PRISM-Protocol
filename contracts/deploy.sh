#!/usr/bin/env bash
set -e

CONTRACTS_DIR="/mnt/c/Users/manov/Desktop/code/PRISM-Protocol/contracts"
APP_IDL_DIR="/mnt/c/Users/manov/Desktop/code/PRISM-Protocol/app/lib/idl"
TARGET_IDL_DIR="/mnt/d/prism-target/idl"
ADMIN_KEY="$CONTRACTS_DIR/keys/admin.json"
PRISM_CORE_ID="E3g9dfc7Azz9MZcM9vJPeWA8JKN3rrU7k35KBm5chcL6"

source ~/.bashrc 2>/dev/null || true
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

echo "=== Step 1: Fund admin from lp_alpha and lp_core ==="
ADMIN_PUBKEY=$(solana-keygen pubkey "$ADMIN_KEY")
echo "Admin pubkey: $ADMIN_PUBKEY"

ADMIN_BAL=$(solana balance "$ADMIN_PUBKEY" --url devnet | awk '{print $1}')
echo "Admin balance: $ADMIN_BAL SOL"

# Transfer from all available wallets to ensure admin has at least 5 SOL
for WALLET in lp_alpha lp_core lp_prime borrower mm; do
  BAL=$(solana balance "$(solana-keygen pubkey "$CONTRACTS_DIR/keys/$WALLET.json")" --url devnet | awk '{print $1}')
  if (( $(echo "$BAL > 0.05" | bc -l) )); then
    SEND=$(echo "$BAL - 0.01" | bc)
    echo "Transferring $SEND SOL from $WALLET..."
    solana transfer \
      --from "$CONTRACTS_DIR/keys/$WALLET.json" \
      "$ADMIN_PUBKEY" "$SEND" \
      --url devnet --allow-unfunded-recipient || true
  fi
done

ADMIN_BAL=$(solana balance "$ADMIN_PUBKEY" --url devnet | awk '{print $1}')
echo "Admin balance after top-up: $ADMIN_BAL SOL"

echo ""
echo "=== Step 2: Extend prism_core program data account (+200KB for safety) ==="
solana program extend "$PRISM_CORE_ID" 200000 \
  --url devnet \
  --keypair "$ADMIN_KEY" || echo "Extend skipped (may already be large enough)"

echo ""
echo "=== Step 3: Deploy both programs ==="
cd "$CONTRACTS_DIR"
anchor program deploy --provider.cluster devnet

echo ""
echo "=== Step 4: Sync IDL files to app ==="
cp "$TARGET_IDL_DIR/prism_core.json" "$APP_IDL_DIR/prism_core.json"
cp "$TARGET_IDL_DIR/prism_amm.json"  "$APP_IDL_DIR/prism_amm.json"
echo "IDL files synced."

echo ""
echo "=== Done! Verifying instructions in app IDL ==="
node -e "
const idl = require('$APP_IDL_DIR/prism_core.json');
console.log('prism_core address:', idl.address);
console.log('instructions:', idl.instructions.map(i => i.name).join(', '));
"
