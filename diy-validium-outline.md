# Private Logic on Public Rails

## Metadata

- **Title:** "Private Logic on Public Rails"
- **Subtitle/alt:** "What building a validium from scratch teaches you about programmable privacy"
- **Author:** Oskar
- **Date:** TBD
- **Description:** We built a validium in ~730 lines of Rust and Solidity. The interesting part isn't the cryptography — it's that the business logic is just normal Rust, proved in zero knowledge and verified on Ethereum.
- **Tags:** private-transfers, validium, risc-zero, ethereum, proof-of-concept
- **Target:** ~3,000 words (matching series average)

---

## 1. The Pattern (~400 words)

Open with the core insight — no preamble about "institutions want privacy."

**Show, don't tell.** Here's a Rust function:

```rust
assert!(balance >= threshold, "Balance below threshold");
```

This line runs inside a ZK proof. Ethereum verifies the proof on-chain. The auditor learns "balance >= threshold" and nothing else. No circuit DSL, no constraint wiring — just Rust.

This is the pattern: **write private logic in a mainstream language, prove it in zero knowledge, verify it on Ethereum.** We built a validium to explore what this looks like end-to-end.

- Brief: what is a validium (one paragraph — data off-chain, validity proofs on-chain, operator holds state)
- Why build one from scratch: to see what's inside the black box. For production, use ZKSync Prividium (same architecture, production infrastructure).
- What RISC Zero gives you: any Rust function becomes a ZK guest program. The prover executes it, produces a STARK proof, and the chain verifies the proof without seeing the inputs.

**Source:** SPEC.md §Executive Summary; disclosure.rs

---

## 2. The Disclosure Proof — Full Exhibit (~600 words)

**The marquee section. Include the full `disclosure.rs` (~40 lines) inline.**

Walk through in three beats:

1. **Setup** (lines 17-24): Read private inputs — secret key, balance, salt, Merkle path, threshold, auditor pubkey. All private. None of this leaves the prover.

2. **Prove membership** (lines 27-29): Derive pubkey from secret key, compute leaf commitment `SHA256(pubkey || balance_le || salt)`, verify Merkle path against state root. This proves "I have an account in this system" without revealing which one.

3. **The business logic** (lines 32-34): `assert!(balance >= threshold)`. That's it. One line of compliance. Then derive a disclosure key binding this proof to a specific auditor (so proofs can't be replayed to unauthorized parties).

4. **Public output** (lines 37-39): Commit only state root, threshold, and disclosure key hash to the proof's public journal. The auditor learns the threshold was met, nothing more.

**The point:** this is the actual verification logic. An institutional compliance officer can read this. Compare: Circom requires ~80 lines of manual signal routing and SHA-256 constraint wiring for the same check. The business logic is identical — `balance >= threshold` — but everything around it is circuit plumbing.

What you could put here instead of `balance >= threshold`:
- AML: `total_outflows_30d <= reporting_limit`
- Capital adequacy: `reserves >= liabilities * ratio`
- Sanctions: `counterparty_hash NOT IN sanctions_list`
- Settlement netting: `assert!(net_position == expected_settlement)`

Same pattern. Write the rule in Rust, prove it, verify on-chain.

**Source:** `methods/guest/src/disclosure.rs` (full file); SPEC.md §Why Rust Guest Programs Matter

---

## 3. The Machine That Makes It Work (~600 words)

Now zoom out. The disclosure proof doesn't exist in isolation — it proves something about an account inside a Merkle tree maintained by an operator. Here's the minimal architecture:

**Three layers** (use SPEC ASCII diagram):
- Off-chain: operator holds account state (pubkey, balance, salt per account)
- ZK layer: RISC Zero guest programs prove state transitions are valid
- On-chain: Ethereum stores only the Merkle root + verifies proofs

**Account model:** `commitment = SHA256(pubkey || balance_le || salt)`. Binary Merkle tree, depth 20. Sequential root checks (`require(oldRoot == stateRoot)`) prevent replay — no nullifiers needed. This is simpler than UTXO but requires a centralized state holder.

**Three operations besides disclosure:**
- **Deposit:** ERC20 into bridge contract, gated by allowlist membership proof
- **Transfer:** Dual-leaf state transition — show the 4-line business logic from `transfer.rs` (same pattern: normal Rust assertions, proved in ZK)
- **Withdrawal:** Single-leaf state transition, bridge verifies proof and transfers tokens

Each operation is a guest program with the same structure: read private inputs → verify Merkle membership → assert business rules → commit new state root. The Solidity contracts just check `oldRoot == stateRoot`, verify the STARK seal, and update the root.

**Keep this section architectural, not exhaustive.** Readers who want operation-level detail can read the SPEC. The point here is: same pattern, four times, building a complete private payment system.

**Source:** SPEC.md §Protocol Design, §Data Structures; `transfer.rs` lines 87-91

---

## 4. What Happens When Trust Fails (~500 words)

The operator sees everything and controls liveness. What if they disappear? What if they censor you?

**The censorship resistance spectrum:**

```
Normal withdraw     →  Forced withdrawal      →  Escape hatch
(operator cooperates)  (user forces on-chain,    (system frozen,
                        1-day deadline)            no ZK needed)
```

**Forced withdrawal (anti-censorship):** User submits a valid ZK withdrawal proof directly to the bridge contract. Operator has 1 day to process it or the system freezes. The operator can't dodge this by churning state — the deadline ticks regardless.

**Escape hatch (operator gone):** After 7 days of inactivity, anyone can freeze the bridge. Users recover funds by revealing their balance on-chain via Merkle proof — no ZK proof needed, because there's no one left to hide from. Privacy is sacrificed for fund recovery. This matches StarkEx and ZKSync's escape hatch pattern.

**The trade-off is explicit:** forced withdrawal preserves ZK privacy; escape hatch doesn't. Both beat losing your funds.

**What users must save:** pubkey, balance, salt (changes every tx), leaf index, Merkle proof. This is "Layer 0" — users are their own DA. Future work: blob checkpoints (operator posts tree snapshots to EIP-4844), encrypted blobs (DA committee preserves privacy until escape).

**Source:** SPEC.md §Operation 4, §Forced Withdrawal; `ValidiumBridge.sol`

---

## 5. The Trust Map (~400 words)

Compact trust model — what's enforced vs what's trusted.

**ZK + on-chain verification enforces:**
- No forged transfers or withdrawals (need sender's secret key)
- No double-spending (sequential root checks)
- No fake compliance proofs (disclosure proof is bound to real state)
- No censorship without consequence (forced withdrawal deadline)
- No permanent fund lock (escape hatch)

**The operator is trusted to:**
- Credit deposits to off-chain accounts (trust gap — no on-chain enforcement)
- Maintain the Merkle tree honestly
- Map pubkeys to real identities (for compliance)
- Provide data availability (Layer 0: users save own data)

**Where this sits vs other IPTF approaches:**

| | Shielded Pool | Plasma | DIY Validium |
|---|---|---|---|
| Operator sees data? | No | Hashes only | Everything |
| Independent exit? | Yes | Yes | Yes (forced/escape) |
| Privacy on exit? | Yes | Yes | Forced: yes. Escape: no |
| Complexity | ~1000 LOC | ~2000+ LOC | ~730 LOC |
| Production equivalent | — | Intmax | ZKSync Prividium |

The validium is the simplest to build and audit, but has the strongest operator trust assumptions. That's the trade-off.

**Source:** SPEC.md §Operator Trust Model, §Privacy Guarantees

---

## 6. Limitations and What's Next (~400 words)

**Honest about what this isn't.** PoC, not production. Key gaps:

- Centralized operator (production: DA committee)
- Layer 0 escape hatch — users save own data (production: blob checkpoints, encrypted DA)
- Hash-based disclosure keys (production: threshold decryption or verifiable encryption)
- No batching — one proof per operation (production: N transfers per proof)
- Deposits/withdrawals are public — privacy only between them

**For production:** ZKSync Prividium provides this same validium architecture with production DA, sequencing, and ecosystem. This PoC shows what's inside.

**The programmable privacy pattern generalizes.** We showed compliance disclosure, but the same architecture supports any private computation you can express in Rust: settlement netting, portfolio rebalancing, credit scoring, identity attestations. The guest program is the only part that changes.

Link to source code (~730 LOC), SPEC, REQUIREMENTS. Invite review.

Cross-reference: shielded pool, plasma, UTXO bonds, Aztec L2, FHE — each makes different trade-offs. This series makes those visible.

**Source:** SPEC.md §Limitations, §Future Work

---

## Source Files Referenced

| File | Usage |
|------|-------|
| `../iptf-pocs/pocs/diy-validium/SPEC.md` | Primary source (`feat/escape-hatch` branch) |
| `../iptf-pocs/pocs/diy-validium/methods/guest/src/disclosure.rs` | Full inline exhibit (§2) |
| `../iptf-pocs/pocs/diy-validium/methods/guest/src/transfer.rs` | Business logic excerpt (§3) |
| `../iptf-pocs/pocs/diy-validium/contracts/src/ValidiumBridge.sol` | Escape hatch + forced withdrawal (§4) |
| `_posts/2026-02-19-building-private-transfers-on-ethereum.md` | Cross-reference style |
| `_posts/2026-02-26-private-stablecoins-with-plasma.md` | Cross-reference style |
