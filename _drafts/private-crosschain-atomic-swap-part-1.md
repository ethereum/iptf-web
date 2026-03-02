---
layout: post
title: "Private Crosschain Atomic Swaps (Part 1 of 2)"
description: "How to build atomic delivery-versus-payment across two chains while hiding amounts, prices, and counterparty identities. Part 1 covers the protocol: shielded UTXO notes, stealth addresses, and the coordination problem."
date: 2026-02-05 10:00:00 +0100
author: "Yanis"
image: /assets/images/default.png
tags:
  - atomic-swap
  - crosschain
  - shielded-pools
  - stealth-addresses
  - proof-of-concept
---

Settlement risk is one of the oldest problems in finance. When two parties trade a bond for cash, neither wants to deliver first. The buyer does not want to pay before receiving the asset; the seller does not want to transfer the asset before receiving payment. Traditional finance solved this decades ago with chains of trusted actors: custodians, central securities depositories, clearing houses. Delivery-versus-Payment (DvP) infrastructure like [DTCC](https://www.dtcc.com/) or [Euroclear](https://www.euroclear.com/) is the coordinating intermediary for both legs of a trade.

In repo markets the chain is longer still. A bank holds collateral through a custodian, posts it to a triparty agent, which moves it to a counterparty's custodian. Every step needs a trusted party and a separate settlement instruction. The system works, but it is slow (T+2 is standard), expensive, and depends entirely on the integrity of intermediaries.

Ethereum changes the settlement model. On a single chain, atomicity is free: a smart contract can exchange two tokens in a single transaction that either completes or reverts entirely in front of the entire network. There is no T+2, no custodian, no clearing house. A bond token and a stablecoin can settle in the same block with no counterparty risk.

But institutions do not live on one chain. Tokenized securities may sit on Ethereum L1, while payment instruments like regulated stablecoins or tokenized deposits may settle on a different network. And crosschain atomicity is an unsolved problem.

## The crosschain settlement problem

### Why finality breaks atomicity

On a single chain, atomicity comes from the EVM's execution model: every transaction is processed against a single shared state. Either all state changes apply or none do. The network enforces this guarantee.

Rollups share L1 as common anchor but that gives you a read relationship, not execution atomicity. A chain can observe what happened on another chain, after finality, but it cannot condition its own state changes on whether a transaction elsewhere finalizes. One leg always settles first. The party that moves second always has the option to defect. Real-time ZK proving of EVM execution may eventually change this — a chain that can verify another's state transition as it happens could in principle condition its own execution on it — but that is not available today.

### Existing approaches

**Hash Time-Locked Contracts (HTLCs)** are the oldest trustless crosschain primitive. Alice generates a secret, locks funds on Chain A against its hash, and Bob locks funds on Chain B against the same hash. Alice reveals the secret to claim on Chain B, which also reveals it to Bob for claiming on Chain A. The problem is timing: the two claim steps are sequential, not atomic. Bob is always the last mover. He can observe the secret from Alice's reveal and decide not to claim, leaving Alice's position exposed. HTLCs also leak trade details publicly: the hash, the timelock, the amounts are all on-chain.

**Trusted bridges** move one asset to the other chain and do the swap locally. They work, but they reintroduce custodial risk: the bridge operator holds your assets during transit. Custody is exactly what institutions were trying to eliminate by settling on-chain.

**Optimistic bridges** reduce trust with fraud proofs, but their seven-day challenge window is longer than the T+2 standard they were meant to improve on.

None of these approaches combine atomicity with privacy. In all of them, trade terms are visible to every observer: amounts, prices, counterparty addresses, timing.

## Building the protocol

### Two shielded pools

In a [previous post](/building-private-transfers-on-ethereum/) we built shielded pools for private stablecoin payments on Ethereum: commitments to notes in a Merkle tree, nullifiers for double-spend prevention, ZK proofs that verify ownership without revealing it. In the UTXO model, assets are discrete private _notes_, not public account balances. A note's contents (amount, owner, asset type) are hidden behind a commitment hash. Only the holder of the spending key can prove ownership.

The UTXO model has a property the account model lacks: it is not tied to EVM accounts or direct contract state changes. In the account model, moving funds requires an ECDSA signature the chain validates against a known address — everyone sees who moved what, and for crosschain settlement you would need to verify the state of both asset contracts across two networks.

The UTXO model sidesteps this entirely. There are no balances in contracts, only note commitments. A transfer is not a state change in a ledger — it is a change of control over a note. The chain never sees the identity, the amount, or the key.

This reframes the crosschain problem. Instead of coordinating state changes across two networks, the question becomes: how do you atomically swap control of two notes — one on each chain — without either party being able to claim one before the other, or spend the same note twice?

The protocol starts from a symmetric setup: a shielded UTXO pool on each network, one for each asset being exchanged.

Alice holds USD notes on Network 1. Bob holds bond notes on Network 2. They want to swap: Alice pays USD, Bob delivers bonds, atomically and privately. Each party will lock a note for the counterparty on their home chain.

The core note structure is the same as the single-chain protocol (commitment, nullifier, owner key, salt), with two additions — `fallbackOwner` and `timeout` — that we will come back to:

![Note fields are hashed into a commitment stored on-chain; spending reveals a nullifier that prevents double-spending](/assets/images/2026-03-05-private-crosschain-swap-part-1/diagram-3-note-structure.png)

The `fallbackOwner` and `timeout` fields will make sense once we explain what can go wrong. For now, the question is how Alice and Bob claim each other's locked note.

### Memos and the limits of direct exchange

In the single-chain shielded pool protocol, after a private transfer the sender attaches an encrypted memo: the note's contents encrypted for the recipient's viewing key. The recipient scans on-chain events, decrypts memos, and discovers their new notes. The sender reveals the note's details directly to the recipient, and no one else.

The trivial approach for crosschain swaps: Alice locks a note for Bob on Network 1 and attaches an encrypted memo with the salt. Bob does the same for Alice on Network 2. Each party reconstructs the other's note from the memo and submits a claim proof.

But memos don't enforce atomicity. The sender is making a one-way transfer, not conditioning their payment on receiving something back. In an atomic swap, Alice needs assurance that Bob's note is locked and claimable before she reveals the details of hers. Memos give no such guarantee. Each party reveals independently, and one always moves first. If Alice's memo goes out before Bob's, Bob can claim Alice's USD note and then walk away without ever locking the bond note.

What we need is a way for Alice to lock a note that _only_ Bob can spend, without revealing his identity on-chain. Then the remaining question is: how do both parties learn each other's claim secrets at the same time?

### Stealth addresses

Each participant has a long-lived meta key pair `(meta_sk, meta_pk)` that is published. To lock a note for a counterparty, the sender generates a fresh ephemeral key pair `(eph_sk, eph_pk)` (conventionally written `r, R = r·G`) and computes a shared secret via ECDH:

```
shared_secret = eph_sk · meta_pk_counterparty
stealth_pk    = meta_pk_counterparty + H("stealth", shared_secret) · G
```

The stealth address `stealth_pk` is a one-time public key. An observer on-chain cannot link it back to `meta_pk_counterparty`. Only the holder of `meta_sk` can derive the corresponding spending key:

```
shared_secret = meta_sk · eph_pk        // eph_pk is public; meta_sk is secret
stealth_sk    = meta_sk + H("stealth", shared_secret)
```

To claim, the counterparty needs two things: the ephemeral public key `eph_pk` and the salt used to construct the note commitment. With `eph_pk` and `meta_sk`, they derive `stealth_sk`. With the salt, they reconstruct the full note and generate a claim proof.

![Sender derives stealth_pk from ephemeral key and recipient's meta_pk; recipient recovers stealth_sk from published eph_pk and own meta_sk](/assets/images/2026-03-05-private-crosschain-swap-part-1/diagram-2-stealth-derivation.png)

The construction is symmetric. Alice generates `(eph_sk_A, eph_pk_A)`, computes `stealth_pk_B` from Bob's meta-key, and locks her USD note with `owner = stealth_pk_B` on Network 1. Bob does the same on Network 2 for Alice. Neither can claim the other's note directly: Alice does not have `meta_sk_B`, Bob does not have `meta_sk_A`.

### The coordination problem

Both notes are now locked to stealth addresses. For Alice to claim the bond note on Network 2, she needs Bob's ephemeral public key `eph_pk_B` and his salt. For Bob to claim the USD note on Network 1, he needs Alice's `eph_pk_A` and her salt. Each party must reveal a secret to let the other claim.

If Alice reveals first, Bob can claim the USD immediately, then choose whether to reveal his own values for Alice to claim the bond. He can defect. If Bob reveals first, Alice has the same option. This is the HTLC problem in another form: one party always moves second.

No cryptographic primitive can force two parties to reveal secrets simultaneously across two separate networks with no shared clock. You need a coordination mechanism.

### Fallback and timeout

Before solving coordination, there is a simpler question: what happens if coordination never succeeds?

This is where `fallbackOwner` and `timeout` come in. Each note carries the original sender as `fallbackOwner` and a `timeout` timestamp. After the timeout, the sender can spend the note back to themselves using the fallback path, without needing the counterparty or any coordinator.

The protocol always terminates in one of two outcomes: both parties receive the other's asset, or both receive their own back. There is no stuck state, no capital locked indefinitely.

![If the timeout passes without settlement, each party reclaims their own funds using the fallbackOwner key embedded in the note](/assets/images/2026-03-05-private-crosschain-swap-part-1/diagram-5-timeout-refund.png)

## How the pieces fit

The protocol needs a coordinator: something that receives the claim secrets from both parties, verifies the swap terms, and reveals everything at once.

What does the coordinator need to get right? It must publish both ephemeral keys and encrypted salts atomically — both or neither — with no ability to selectively reveal one leg. Stealth addresses keep it non-custodial: even with access to everything submitted, it cannot derive either party's spending key. Both parties must be able to verify, before handing over their secrets, that the coordinator's code does what it claims. And the failure mode must be bounded: the worst it can do is refuse to act, which triggers the timeout and lets both parties reclaim.

The full protocol flow:

1. Alice and Bob agree on swap terms off-chain (amounts, assets, timeout window).
2. Alice locks a USD note to `stealth_pk_B` on Network 1. Bob locks a bond note to `stealth_pk_A` on Network 2.
3. Both submit their ephemeral keys and encrypted salts to the coordinator.
4. The coordinator verifies both locked notes match the agreed terms on-chain.
5. The coordinator publishes `eph_pk_A`, `eph_pk_B`, and the encrypted salts to an announcement contract — atomically.
6. Both parties read the announcement, derive their stealth spending keys, reconstruct the note, and claim.

If step 5 never happens, the timeout expires and both parties reclaim via the fallback path.

| Component                 | Description                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Shielded pool (Network 1) | Commitments and nullifiers for stablecoin notes                                        |
| Shielded pool (Network 2) | Commitments and nullifiers for bond token notes                                        |
| Announcement contract     | Records the coordinator's atomic revelation                                            |
| Note                      | `{chainId, value, assetId, owner (stealth_pk), fallbackOwner, timeout, salt}`          |
| Coordinator               | Verifies both locked legs on-chain; publishes `eph_pk_A`, `eph_pk_B`, encrypted salts atomically |

What the protocol hides: amounts, asset types, counterparty identities, the link between the two locked notes.

What the protocol leaks: that a time-locked note exists on each chain, and approximately when the swap window closes. After settlement, both parties can spend their claimed notes into fresh standard notes to rejoin the general anonymity set.

Each component has one job: ZK circuits verify note formation and ownership, shielded pools prevent double-spending, and the coordinator makes revelation atomic across chains.

![Both parties lock notes to stealth addresses on their respective chains — the contract verifies each note via ZK proof — but the two locks are independent: what makes them atomic is the subject of Part 2](/assets/images/2026-03-05-private-crosschain-swap-part-1/diagram-4-locking-flow.png)

The coordinator is the only component not yet specified. It could be built from a Trusted Execution Environment, a multi-party computation protocol, or fully homomorphic encryption — each with different trust assumptions and performance trade-offs. In [Part 2](/private-crosschain-atomic-swaps-tee-part-2/), we pick one: a TEE running in AWS Nitro Enclaves. We go inside the enclave, examine what attestation actually proves, work through the real attack surfaces, and walk through what the demo logs show.

The full implementation is open source, with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/approach-private-trade-settlement/tee_swap/SPEC.md).
