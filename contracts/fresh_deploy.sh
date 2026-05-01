#!/usr/bin/env bash
set -e

[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Find real anchor binary — AVM puts versioned binaries under ~/.avm/versions/
ANCHOR=$(find "$HOME/.avm/versions" -name "anchor" -type f 2>/dev/null | sort -V | tail -1)
# Fallback: cargo-installed anchor
[ -z "$ANCHOR" ] && ANCHOR="$HOME/.cargo/bin/anchor"
[ ! -f "$ANCHOR" ] && { echo "ERROR: cannot find anchor binary under ~/.avm/versions or ~/.cargo/bin"; exit 1; }

echo "anchor binary: $ANCHOR"
"$ANCHOR" --version
echo "solana: $(solana --version)"

CONTRACTS_DIR="/mnt/c/Users/manov/Desktop/code/PRISM-Protocol/contracts"
APP_DIR="/mnt/c/Users/manov/Desktop/code/PRISM-Protocol/app"
TARGET_DIR="/mnt/d/prism-target"
ADMIN_KEY="$CONTRACTS_DIR/keys/admin.json"

echo ""
echo "=== Step 1: Revert config seed to 'config' ==="
find "$CONTRACTS_DIR/programs/prism-core/src" -name "*.rs" \
  -exec sed -i 's/b"config2"/b"config"/g' {} +
echo "Done."

echo ""
echo "=== Step 2: Generate new program keypairs ==="
CORE_KP="$CONTRACTS_DIR/keys/prism_core_new.json"
AMM_KP="$CONTRACTS_DIR/keys/prism_amm_new.json"
solana-keygen new --outfile "$CORE_KP" --no-bip39-passphrase --force -s
solana-keygen new --outfile "$AMM_KP"  --no-bip39-passphrase --force -s
CORE_ID=$(solana-keygen pubkey "$CORE_KP")
AMM_ID=$(solana-keygen pubkey "$AMM_KP")
echo "prism_core: $CORE_ID"
echo "prism_amm:  $AMM_ID"

echo ""
echo "=== Step 3: Patch declare_id! and Anchor.toml ==="
OLD_CORE="E3g9dfc7Azz9MZcM9vJPeWA8JKN3rrU7k35KBm5chcL6"
OLD_AMM="4y3iZE8WSAJyMrUgnSCDmqzVQru63UF9YU5L74EaUJY3"
sed -i "s/$OLD_CORE/$CORE_ID/g" "$CONTRACTS_DIR/programs/prism-core/src/lib.rs"
sed -i "s/$OLD_AMM/$AMM_ID/g"   "$CONTRACTS_DIR/programs/prism-amm/src/lib.rs"
sed -i "s/$OLD_CORE/$CORE_ID/g" "$CONTRACTS_DIR/Anchor.toml"
sed -i "s/$OLD_AMM/$AMM_ID/g"   "$CONTRACTS_DIR/Anchor.toml"
echo "IDs patched."

echo ""
echo "=== Step 4: Build ==="
cd "$CONTRACTS_DIR"
"$ANCHOR" build

echo ""
echo "=== Step 5: Fresh deploy ==="
solana program deploy "$TARGET_DIR/deploy/prism_core.so" \
  --keypair "$CORE_KP" --url devnet --upgrade-authority "$ADMIN_KEY"

solana program deploy "$TARGET_DIR/deploy/prism_amm.so" \
  --keypair "$AMM_KP" --url devnet --upgrade-authority "$ADMIN_KEY"

echo ""
echo "=== Step 6: Sync IDL + constants ==="
cp "$TARGET_DIR/idl/prism_core.json" "$APP_DIR/lib/idl/prism_core.json"
cp "$TARGET_DIR/idl/prism_amm.json"  "$APP_DIR/lib/idl/prism_amm.json"
sed -i "s/$OLD_CORE/$CORE_ID/g" "$APP_DIR/lib/constants.ts"
sed -i "s/$OLD_AMM/$AMM_ID/g"   "$APP_DIR/lib/constants.ts"

echo ""
echo "=== DONE ==="
echo "prism_core: $CORE_ID"
echo "prism_amm:  $AMM_ID"
echo "Restart dev server, then run Full Setup in /admin"
