# CLAUDE.md — Coding Conventions for PRISM Protocol

You are coding on the PRISM Protocol codebase. These rules apply to every file you write or edit.

If you're new to this project, **read [docs/README.md](README.md) first** for orientation, then this file, then [12-reference-card.md](12-reference-card.md). After that, you have full context to start coding.

---

## Project structure

Standard Anchor + Next.js workspace:

```
prism-protocol/
├── docs/                    All design docs. Don't modify without a clear reason.
├── programs/
│   ├── prism-core/          Anchor program: tranche vault, yield, default
│   └── prism-amm/           Anchor program: AMM for tranche tokens
├── tests/                   Mocha tests for both programs
├── scripts/                 TypeScript setup + utility scripts
├── keys/                    Devnet wallet keypairs (committed — devnet only!)
├── app/                     Next.js frontend
└── target/                  Build output (gitignored)
```

---

## Rust / Anchor conventions

### Naming

- **Modules / files:** `snake_case` — `nav.rs`, `waterfall.rs`, `accrue_yield.rs`
- **Structs / enums:** `PascalCase` — `Tranche`, `CreditEventType`
- **Functions / variables:** `snake_case` — `compute_nav_q`, `total_assets`
- **Constants:** `SCREAMING_SNAKE_CASE` — `Q64_ONE`, `MIN_LIQUIDITY`
- **Anchor instruction handlers:** `snake_case` matching the instruction name — `pub fn deposit(ctx: Context<Deposit>, ...)`
- **Anchor account contexts:** `PascalCase` matching the instruction — `pub struct Deposit<'info>`
- **PDA seed strings:** lowercase, no underscores in literals — `b"config"`, `b"loss_bucket"`, `b"tranche"`

### Style

- Use `cargo fmt` defaults (4-space indent, 100-char line width)
- Imports grouped: `std`, then external crates, then `crate::`
- One `use` line per item, not bundled (Anchor's convention)
- Doc comments (`///`) on **public** items only — internal helpers don't need them
- No `unwrap()` in instruction handlers — use `?` with our `PrismError` enum

### Error handling

- All custom errors in `programs/prism-core/src/errors.rs` and `programs/prism-amm/src/errors.rs`
- Pattern: `require!(condition, PrismError::SpecificError);` — Anchor macro
- For computed errors: `return Err(PrismError::X.into());`
- **Never** use generic `anyhow` or `thiserror` errors in handlers — judges check error codes
- See [12-reference-card.md §error codes](12-reference-card.md) for the full enum

### Account validation

- Prefer Anchor's `#[account(...)]` constraints over imperative checks in handlers
- Use `has_one`, `seeds`, `bump`, `constraint = ...` aggressively
- For PDA bumps: pass `bump = stored_bump_value` (NOT `bump`) when reading existing accounts. Use `bump` (no value) only on `init`
- For `init` instructions: use `init_if_needed` only when truly needed (e.g., user's ATA in deposit). Otherwise use `init` so a duplicate init fails loudly

### Math

- Use the `math::q` module (see [09-lld-completion.md §9.1](09-lld-completion.md)) for all NAV math. **Don't reimplement.**
- Use `checked_*` methods (`checked_add`, `checked_mul`) for any multi-step arithmetic — overflow is silent in release builds
- Q64.64 representation: `u128` where `Q64_ONE = 1u128 << 64` represents 1.0

### Anchor footguns (the don'ts)

| Don't | Do |
|---|---|
| ❌ `bump` (no value) when reading an existing PDA | ✅ `bump = vault.bump` (read stored bump) |
| ❌ `init` on a token account that already exists | ✅ `init_if_needed` (sparingly) or pre-init in setup |
| ❌ Use `ctx.bumps.get("name")` (deprecated) | ✅ `ctx.bumps.name` (Anchor 0.30+) |
| ❌ Forget `mut` on accounts you modify | ✅ Add `mut` to every account whose data or lamports change |
| ❌ Pass mints as `UncheckedAccount` | ✅ `Account<'info, Mint>` for type safety |
| ❌ Sign CPI without seeds for PDA-controlled accounts | ✅ Use `CpiContext::new_with_signer(...)` with seeds |
| ❌ Skip `space = 8 + Struct::INIT_SPACE` on `init` | ✅ Always derive `InitSpace` and use the macro |
| ❌ Recompute PDA bumps in handlers | ✅ Store the bump in the account at init time, read it later |
| ❌ Forget `system_program` in `init` contexts | ✅ Always include it |

---

## TypeScript / Next.js conventions

### Naming

- **Files:** `PascalCase` for components (`TrancheBar.tsx`), `camelCase` for hooks/utilities (`useTranche.ts`, `pda.ts`)
- **React components:** `PascalCase` — `<TrancheBar />`, `<DepositForm />`
- **Hooks:** `useXxx` prefix — `useTranche`, `useDeposit`
- **Constants:** `SCREAMING_SNAKE_CASE` — `Q64_ONE`, `DEMO_WALLETS`
- **Types / interfaces:** `PascalCase` — `TrancheKind`, `UserPnL`
- **Variables / functions:** `camelCase` — `navPerShare`, `computeShares`

### Style

- Use Prettier defaults (2-space indent, single quotes, semicolons, 100-char line width)
- Use ESLint `next/core-web-vitals` config
- Functional components only — no class components
- Use `const` over `let` wherever possible — `let` only when reassigning
- Prefer named exports over default exports for components (default only for Next.js pages)
- Imports grouped: React → next → external libs → `@/lib/...` → `@/components/...` → relative

### React patterns

- All async data fetching through **React Query** (`@tanstack/react-query`)
- All mutations through `useMutation` — never bare `await program.methods.X.rpc()` in components
- All transactions wait for `commitment: "confirmed"` (not `finalized`)
- All errors surface via `react-hot-toast` toast — never silent
- Use Solana Wallet Adapter hooks (`useWallet`, `useConnection`) — don't build custom wallet logic

### Anchor TS gotchas

| Don't | Do |
|---|---|
| ❌ Use raw `BN` arithmetic without `.toString()` for display | ✅ Always `.toString()` or convert to number for UI |
| ❌ Pass numbers directly as `u64` args | ✅ Wrap in `new BN(value)` |
| ❌ Hardcode PDA addresses | ✅ Derive via `lib/pda.ts` helpers |
| ❌ Forget to await `confirmTransaction` after `.rpc()` | ✅ Use `.rpc({ commitment: "confirmed" })` (auto-confirms) |
| ❌ Skip `await provider.connection.confirmTransaction(...)` in setup scripts | ✅ Always confirm before next step in setup |
| ❌ Build instructions then call `.rpc()` separately | ✅ For multi-ix tx: build with `.instruction()`, combine in `Transaction`, send via `provider.sendAndConfirm` |

---

## Test conventions (hybrid per Q3)

### Rust unit tests (in `programs/*/src/math/*.rs`)

- `snake_case` test names: `test_compute_nav_q_with_zero_supply`
- Use `#[cfg(test)] mod tests { ... }` pattern
- Hardcode expected values from [04-data-flows.md](04-data-flows.md) tables

### TypeScript integration tests (in `tests/`)

- Mocha + Chai (Anchor's default)
- `it("...")` style: `it("mints shares 1:1 on first deposit at NAV 1.0", async () => {...})`
- Group with `describe("instruction_name", () => {...})`
- Use a beforeEach to reset state when needed (or use vault_id sequencing per [§8.22](08-open-questions.md))
- Assert exact NAV values from [04-data-flows.md §4.3](04-data-flows.md) and [§4.5](04-data-flows.md) — math correctness is the highest-risk failure

---

## Git conventions

### Commits

- **Conventional commits** style: `type(scope): subject`
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`
- Scopes: `core`, `amm`, `app`, `tests`, `scripts`, `docs`
- Examples:
  - `feat(core): implement deposit instruction with NAV-per-share math`
  - `feat(amm): add constant-product swap with fee accumulation`
  - `fix(core): correct loss cascade order — equity must drain first`
  - `test(core): add cascade test matching §4.5 numbers`

### Branches

- `main` is the only long-lived branch
- Direct commits to `main` are fine for hackathon pace (no PR ceremony for solo or 2-person team)
- Tag the demo recording commit: `git tag v0.1.0-demo`

### Don't commit

- `.env` (real one — only `.env.example` is committed)
- `target/` (Rust build output)
- `node_modules/`
- `.next/` (Next.js build output)
- `test-ledger/` (Solana local validator state)
- Any mainnet keys (devnet keys in `keys/` are OK)

---

## Editing the design docs

The 9 numbered docs in `docs/` (`00-overview.md` through `09-lld-completion.md`) are **locked architecture**. Don't modify them unless:

1. The user explicitly asks for a change
2. You found a real inconsistency between two docs (then fix both + flag it)
3. You're propagating a locked decision (e.g., updating §4.5 numbers because of an §8.21 lock)

If you make a doc change, **also update the relevant memory entry** at `~/.claude/projects/-Users-akashchakraborty-Projects-PRISM-Protocol/memory/project_prism_overview.md` so future sessions inherit it.

The non-numbered docs in `docs/` ([README.md](README.md), [CLAUDE.md](CLAUDE.md), [12-reference-card.md](12-reference-card.md), [13-demo-runbook.md](13-demo-runbook.md)) are operational and can evolve more freely as you learn during the build.

---

## When you don't know something

- **Architectural question:** check [00-overview.md](00-overview.md) → [08-open-questions.md](08-open-questions.md)
- **Magic number / constant / PDA seed:** [12-reference-card.md](12-reference-card.md)
- **Instruction context structure:** [09-lld-completion.md §9.3](09-lld-completion.md)
- **Handler logic / pseudocode:** [09-lld-completion.md §9.4](09-lld-completion.md)
- **Frontend component:** [09-lld-completion.md §9.7](09-lld-completion.md)
- **User flow / sequence diagram:** [04-data-flows.md](04-data-flows.md)
- **Day-N task:** [06-mvp-build-plan.md §6.4](06-mvp-build-plan.md)
- **Partner SDK call (Switchboard / Cloak):** [09-lld-completion.md §9.9, §9.10](09-lld-completion.md)

If still stuck, **stop and ask the user** — better one clarification message than 200 lines of wrong code.

---

## Hard rules (don't break)

1. Tier 1 (`deposit`, `accrue_yield`, `trigger_credit_event`) must work perfectly before any Tier 2 or 3 work begins
2. The vault USDC reserve invariant (`reserve.amount == sum(tranche.total_assets)`) holds at all times — enforce on default by transferring loss to `loss_bucket` PDA
3. NAV edge cases: handle first-deposit, total wipeout, post-wipe deposit blocking — see [09-lld-completion.md §9.1 + §9.4 deposit handler](09-lld-completion.md)
4. Test math values must match [§4.3](04-data-flows.md) and [§4.5](04-data-flows.md) exactly
5. IDL sync after every contract change: `anchor build && cp target/idl/*.json app/src/lib/idl/` and commit
6. Never modify locked architecture without user approval (see "Editing the design docs" above)

End of conventions. Now go read [12-reference-card.md](12-reference-card.md) and start building.
