---
layout: post
title: "DIY Validium: Private Logic on Public Rails"
description: "A validium PoC where the business logic is ordinary Rust, proved in zero knowledge and verified on Ethereum."
date: 2026-03-18 10:00:00 +0800
author: "Oskar"
image: /assets/images/2026-03-18-diy-validium/hero.png
tags:
  - private-transfers
  - validium
  - risc-zero
  - ethereum
  - proof-of-concept
---

What does a private payment system look like when the business logic is ordinary Rust, proved in zero knowledge and verified on Ethereum? We built a [validium](https://ethereum.org/developers/docs/scaling/validium/) to find out.

Here's a line of vanilla Rust code:

```rust
assert!(balance >= threshold, "Balance below threshold");
```

This runs inside a zero-knowledge proof. Ethereum verifies the proof on-chain. An auditor learns that `balance >= threshold` and nothing else. Not the actual balance, not who holds it, not where it sits in the ledger.

This post walks through the PoC layer by layer: the guest program pattern, the validium architecture, and the trust model.

## Write Rust, prove it, verify on-chain

A validium is a type of rollup that keeps account data off-chain with an operator and posts only commitments and proofs to L1. The L1 contract verifies that the operator performed each state transition correctly. If a transfer violates the rules, the proof won't verify and the contract rejects it. Production systems like ZKSync's Prividium implement this architecture with full infrastructure. We wanted to strip it down to the moving parts.

The key component is the zkVM (zero-knowledge virtual machine). RISC Zero is one of several, alongside Succinct's SP1 and Polygon Miden's VM. The idea is the same: write a program in Rust, execute it inside the zkVM, get a cryptographic proof that the execution was correct. The verifier contract checks the proof without seeing the inputs. We used RISC Zero here, but nothing about the approach requires a specific prover.

In earlier posts we explored [shielded pools](/building-private-transfers-on-ethereum/) (UTXO model, privacy from everyone) and [plasma](/private-stablecoins-with-plasma/) (client-side proving, self-sovereign exit). The validium sits at a different point in the design space: the operator sees everything, but the chain enforces correctness. That tradeoff is worth understanding. The operator is trusted for liveness and deposit crediting, but cannot forge state transitions. The trust section below makes the boundaries explicit.

![zkVM pattern: private inputs go in, only proof comes out](/assets/images/2026-03-18-diy-validium/zkvm-pattern.png)

## Inside a guest program

The easiest way to see the pattern is the disclosure proof. It lets an account holder prove to an auditor that their balance meets some threshold, without revealing the actual balance. Here's the full program, about 40 lines of Rust:

```rust
use guest_crypto::{account_commitment, compute_root, sha256};

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read private inputs
    let secret_key: [u8; 32] = risc0_zkvm::guest::env::read();
    let balance: u64 = risc0_zkvm::guest::env::read();
    let salt: [u8; 32] = risc0_zkvm::guest::env::read();
    let path: Vec<[u8; 32]> = risc0_zkvm::guest::env::read();
    let indices: Vec<bool> = risc0_zkvm::guest::env::read();
    let threshold: u64 = risc0_zkvm::guest::env::read();
    let auditor_pubkey: [u8; 32] = risc0_zkvm::guest::env::read();

    // Derive identity and verify account exists
    let pubkey = sha256(&secret_key);
    let leaf = account_commitment(&pubkey, balance, &salt);
    let merkle_root = compute_root(leaf, &path, &indices);

    // === Business logic ===
    assert!(balance >= threshold, "Balance below threshold");
    let disclosure_key_hash =
        sha256(&[&pubkey[..], &auditor_pubkey[..], b"disclosure_v1"].concat());

    // Commit public outputs
    risc0_zkvm::guest::env::commit_slice(&merkle_root);
    risc0_zkvm::guest::env::commit_slice(&threshold.to_be_bytes());
    risc0_zkvm::guest::env::commit_slice(&disclosure_key_hash);
}
```

It reads seven private inputs: the account holder's secret key, their balance, a random salt, a Merkle path and indices, a threshold, and the auditor's public key. None of this leaves the prover. The zkVM executes in isolation; only the public outputs and the proof come out.

Then it proves the account exists: derive the public key from the secret key (`sha256(&secret_key)`), compute the leaf commitment (`SHA256(pubkey || balance_le || salt)`), and walk the Merkle path to reconstruct the root. If the root matches what's on-chain, the prover has shown "I hold an account in this system" without revealing which one.

The actual business logic is one line: `assert!(balance >= threshold)`. If it fails, proof generation fails. After that, a disclosure key gets derived that binds this proof to a specific auditor through domain separation (`"disclosure_v1"`), so the proof can't be replayed to someone else.

The program commits three values to the proof's public journal: the Merkle root, the threshold, and the disclosure key hash. That's all the auditor gets. Balance met a threshold, against a specific state root, bound to their identity.

A compliance officer can read this code. Compare that to Circom, where the same check needs roughly 80 lines of manual signal routing and SHA-256 constraint wiring. The business logic (`balance >= threshold`) is identical either way; everything around it in Circom is circuit plumbing. The tradeoff is maintainability vs performance: zkVMs are slower than hand-optimized circuits, but the code is readable and auditable.

What else could go in that `assert!` line?

- AML reporting: `assert!(total_outflows_30d <= reporting_limit)`
- Capital adequacy: `assert!(reserves >= liabilities * ratio)`
- Sanctions screening: `assert!(counterparty_hash NOT IN blocked_list)`
- Access control: `assert!(role == ADMIN || is_member(group))`
- Rate limiting: `assert!(request_count_1h < max_requests)`
- Voting eligibility: `assert!(voter_weight > 0 && !already_voted)`

The guest program is the only thing that changes. The proving and verification infrastructure stays the same.

## The validium architecture

The disclosure proof proves something about an account inside a Merkle tree, maintained by an operator, anchored to Ethereum. Here's the architecture we ended up with:

![Three-layer validium architecture: operator, ZK layer, Ethereum](/assets/images/2026-03-18-diy-validium/architecture.png)

The operator holds account state off-chain: a public key, a balance, and a random salt per account. This is the only place where plaintext balances exist. RISC Zero guest programs prove that state transitions follow the rules: the prover executes the program and produces a STARK proof. Raw STARKs are too large to verify on Ethereum directly, so RISC Zero wraps each one in a Groth16 SNARK via proof composition. The on-chain verifier checks the compact Groth16 proof (a few hundred bytes, affordable gas). Ethereum stores a single Merkle root and verifies these proofs. The contracts check that the old root matches, verify the proof seal, and update the root.

Each account is a leaf in a Merkle tree. The leaf is a hash of the account's public key, balance, and a random salt. Each operation updates the on-chain root, so stale proofs are automatically invalid. The tradeoff is that a centralized state holder is required. If you're used to UTXO models (Zcash, our [shielded pool PoC](/building-private-transfers-on-ethereum/)), this is different: no nullifiers, no note-splitting, no change outputs. One leaf per account, updated in place.

Four operations, each following the same guest-program structure (read private inputs, verify Merkle membership, assert business rules, commit new state root):

Deposit locks ERC-20 tokens in the bridge contract. Entry is gated by an allowlist: the user proves their public key appears in a separate membership Merkle tree, without revealing which leaf. The operator then credits the balance off-chain. This is a trust gap (more on that below).

Transfer is a dual-leaf state transition: sender balance decreases, recipient balance increases. The guest program enforces four rules:

```rust
assert_ne!(sender_pubkey, recipient_pubkey, "Self-transfer not allowed");
assert!(amount > 0, "Transfer amount must be positive");
assert!(sender_balance >= amount, "Insufficient balance");
assert!(recipient_balance <= u64::MAX - amount, "Recipient balance overflow");
```

Normal Rust assertions, proved in ZK, verified on Ethereum. Same structure as disclosure.

Withdrawal is a single-leaf state transition. The bridge verifies the proof, updates the state root, and transfers ERC-20 tokens. This only works if the operator cooperates by providing the Merkle path.

Disclosure is the compliance proof detailed above. Read-only, no state mutation.

The full [specification](https://github.com/ethereum/iptf-pocs/tree/master/pocs/diy-validium/SPEC.md) covers each operation in detail.

## Trust, safety, and trade-offs

The operator sees every balance, every transfer, every identity. They control who can participate (via the allowlist) and they control liveness (no operator, no proofs). So what happens when things go wrong?

### Censorship resistance

The PoC implements three tiers of withdrawal. Each assumes less about operator cooperation.

![Censorship resistance spectrum: normal, forced, escape](/assets/images/2026-03-18-diy-validium/censorship-resistance.png)

Normal withdrawal is the default path. The operator provides the Merkle path, generates a proof, the bridge transfers tokens.

If the operator refuses to process your withdrawal (censorship), you can submit a forced withdrawal request with a valid ZK proof. The contract verifies the proof but does not execute the withdrawal; it queues the request with a one-day deadline. The operator must process it within that window. If they don't, anyone can freeze the entire bridge. The operator can't dodge this by churning state: even if they post other proofs that change the state root (making the forced request's old root stale), the deadline still ticks. Either they process it, or the system freezes.

If the operator disappears entirely (seven days of inactivity), anyone can freeze the bridge permanently. Once frozen, users recover funds by revealing their balance on-chain via a Merkle proof. No ZK proof needed, because there's no one left to hide from. Privacy gets sacrificed for fund recovery. This is the same escape hatch pattern that StarkEx and ZKSync use.

There's a real catch, though. To use the escape hatch, you need to have saved your current public key, balance, salt, leaf index, and Merkle sibling path. The salt changes on every state transition. Lose your current salt and you can't construct a valid commitment. For multi-device setups and institutional key management, this is not a trivial problem. The [SPEC](https://github.com/ethereum/iptf-pocs/tree/master/pocs/diy-validium/SPEC.md) describes layered DA extensions to reduce the burden: blob checkpoints (operator periodically posts Merkle snapshots to EIP-4844 blobs) and encrypted blobs (data encrypted to a DA committee, preserving privacy until escape is actually needed).

### The trust model

| Question | Short answer | Detail |
|----------|--------------|--------|
| Can the operator steal funds or forge transactions? | No | ZK proofs enforce correct state transitions. The operator cannot forge withdrawals or fake balances. But deposit crediting is trusted, not enforced on-chain: a malicious operator could strand deposited funds by refusing to credit them. |
| Can the operator block you from leaving? | No | Forced withdrawal (1-day deadline) or escape hatch (7-day fallback). But the operator controls day-to-day access via the allowlist. |
| Who can see what? | It depends | Public observers see deposits and withdrawals only. The operator sees everything. Regulators see exactly what disclosure proofs reveal. |

Some scenarios to make this concrete:

Your operator refuses your withdrawal. You submit a forced withdrawal with a valid ZK proof. They have one day. If they ignore it, the system freezes and everyone exits via the escape hatch.

Your operator vanishes. After seven days of silence, anyone can freeze the bridge. You reveal your balance on-chain and withdraw directly. You need your saved account data.

A competitor analyzes the chain. They see deposit and withdrawal amounts, but nothing between. All transfers, balances, and compliance proofs are off-chain.

A regulator wants to audit your balance. You produce a disclosure proof: `balance >= threshold`. They learn that one fact.

### Where validium fits

This privacy model works when the operator is a trusted party by design. It doesn't work when users need privacy from the infrastructure itself.

| Model | Does well | Trades off |
|-------|-----------|------------|
| **Validium** (this PoC) | Programmable compliance in Rust. L1 settlement. Clean audit model: operator has visibility, external auditors get scoped ZK proofs. Strong exit guarantees. | Operator sees everything. Privacy only from public observers, not from infrastructure. |
| **Shielded pool** ([previous post](/building-private-transfers-on-ethereum/)) | Privacy from everyone, including the operator. User holds all keys. | Compliance requires viewing keys. Business logic constrained by circuit DSL (Noir, Circom). |
| **Plasma** ([previous post](/private-stablecoins-with-plasma/)) | Self-sovereignty. Client-side proving. No operator state dependency. | More complex state management. Harder to customize business logic. |
| **Private shared state** (MPC/FHE/TEE) | Multi-party privacy: no single party sees everything. Supports bilateral netting, shared order books. | Requires MPC network or FHE infrastructure. Honest-majority assumptions. Batch latency. Not yet production-ready. |

The validium makes sense when the operator is trusted by design (a single-issuer stablecoin, internal settlement within one institution, a regulated custodian) and you want programmable compliance with L1 finality. It's the wrong model when the operator shouldn't see user data.

## Limitations and what's next

This is a PoC. Some of the gaps are straightforward to close, others are open problems.

On the engineering side: the operator is centralized (production would use a DA committee or post calldata). Each state transition updates the root, which invalidates any in-flight proofs built against the old root, so there's no concurrent transaction processing without batching. Users save their own data for escape (production would add blob checkpoints or encrypted DA). Disclosure keys are hash-based (production would use verifiable encryption; both Aztec and Miden are exploring this). Deposits and withdrawals are public.

### Where this leads

A few questions we keep returning to:

**Private shared state.** This validium gives one operator full visibility. But what about two institutions that want to share a ledger (bilateral netting positions, a shared collateral pool) without either seeing the other's full book? That's the private shared state problem. TACEO's Merces uses MPC with co-SNARKs: parties secret-share their inputs and jointly produce a ZK proof without any single node seeing plaintext. FHE-based approaches compute over encrypted data directly. TEE-based approaches (like the [Nitro enclave work](/private-crosschain-atomic-swap-part-2/) we explored earlier) use hardware isolation. Each makes different bets on simplicity, throughput, and trust. The [IPTF map](https://github.com/ethereum/iptf-map) breaks down these patterns in detail.

**Cross-validium transfers.** Moving funds between validiums currently requires a public withdraw-then-deposit cycle, which links the two operations on-chain. Private atomic bridges are unsolved. The fundamental tension is between privacy, atomicity, and latency, and it's not clear you can have all three.

**Programmable privacy beyond payments.** The guest-program pattern works for any private computation: identity attestation, credit scoring, portfolio rebalancing, supply chain proofs. The question we don't have a good answer to yet is what the right abstraction layer looks like. Should each institution build custom guest programs? Or do we need a shared library of composable privacy primitives that different institutions can plug together? It probably depends on how much the business logic actually varies between institutions, and we don't know that yet.

The `assert!` line in the guest program is the whole point. The guest program is where business logic lives. Everything else, the Merkle tree, the bridge contract, the escape hatch, exists to make that one line trustworthy on a public chain.

The full implementation is [open source](https://github.com/ethereum/iptf-pocs/tree/master/pocs/diy-validium), with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/master/pocs/diy-validium/SPEC.md) and [formal requirements](https://github.com/ethereum/iptf-pocs/tree/master/pocs/diy-validium/REQUIREMENTS.md). For production validium infrastructure, ZKSync's Prividium provides this architecture with production DA and sequencing. The code is open and we'd welcome feedback.
