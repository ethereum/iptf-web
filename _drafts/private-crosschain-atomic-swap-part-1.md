---
layout: post
title: "Private Crosschain Atomic Swaps with TEEs (Part 1 of 2)"
description: "How to build atomic delivery-versus-payment across two chains while hiding
amounts, prices, and counterparty identities. Part 1 covers the protocol: shielded
UTXO notes, stealth addresses, and a TEE as the coordination point."
date: 2026-02-05 10:00:00 +0100
author: "Yanis"
image: /assets/images/default.png
tags:
  - atomic-swap
  - crosschain
  - shielded-pools
  - stealth-addresses
  - TEE
  - proof-of-concept
---

Settlement risk is one of the oldest problems in finance. When two parties trade a bond for cash, neither wants to deliver first. The buyer does not want to pay before receiving the asset; the seller does not want to transfer the asset before receiving payment. Traditional finance solved this decades ago with chains of trusted actors: custodians, central securities depositories, clearing houses. Delivery-versus-Payment (DvP) infrastructure like [DTCC](https://www.dtcc.com/) or [Euroclear](https://www.euroclear.com/) is the coordinating intermediary for both legs of a trade.

In repo markets the chain is longer still. A bank holds collateral through a custodian, posts it to a triparty agent, which moves it to a counterparty's custodian. Every step needs a trusted party and a separate settlement instruction. The system works, but it is slow (T+2 is standard), expensive, and depends entirely on the integrity of intermediaries.

Ethereum changes the settlement model. On a single chain, atomicity is free: a smart contract can exchange two tokens in a single transaction that either completes or reverts entirely in front of the entire network. There is no T+2, no custodian, no clearing house. A bond token and a stablecoin can settle in the same block with no counterparty risk.

But institutions do not live on one chain. Tokenized securities may sit on Ethereum L1, while payment instruments like regulated stablecoins or tokenized deposits may settle on a different network. And crosschain atomicity is an unsolved problem.

## The crosschain settlement problem

### Why finality breaks atomicity

On a single chain, atomicity comes from the EVM's execution model: every transaction is processed against a single shared state. Either all state changes apply or none do. The network enforces this guarantee.

Across two chains, there is no shared state. Each network has its own ledger, its own finality, its own mempool. A transaction on Network 1 is invisible to Network 2 until something explicitly bridges the information. And that bridge is where trust creeps back in.

The fundamental challenge is _finality_. For a settlement to be atomic, both legs must finalize, or both must revert. But on two separate chains, finality is not coordinated. A transaction on one chain can finalize while the corresponding transaction on the other is still pending, fails, or gets reorganized away.

### Existing approaches

**Hash Time-Locked Contracts (HTLCs)** are the oldest trustless crosschain primitive. Alice generates a secret, locks funds on Chain A against its hash, and Bob locks funds on Chain B against the same hash. Alice reveals the secret to claim on Chain B, which also reveals it to Bob for claiming on Chain A. The problem is timing: the two claim steps are sequential, not atomic. Bob is always the last mover. He can observe the secret from Alice's reveal and decide not to claim, leaving Alice's position exposed. HTLCs also leak trade details publicly: the hash, the timelock, the amounts are all on-chain.

**Trusted bridges** move one asset to the other chain and do the swap locally. They work, but they reintroduce custodial risk: the bridge operator holds your assets during transit. Custody is exactly what institutions were trying to eliminate by settling on-chain.

**Optimistic bridges** reduce trust with fraud proofs, but introduce long finality windows (hours to days) that are incompatible with institutional settlement timelines.

None of these approaches combine atomicity with privacy. In all of them, trade terms are visible to every observer: amounts, prices, counterparty addresses, timing.

## Building the protocol

### Two shielded pools

In a [previous post](/building-private-transfers-on-ethereum/) we built shielded pools for private stablecoin payments on Ethereum: commitments to notes in a Merkle tree, nullifiers for double-spend prevention, ZK proofs that verify ownership without revealing it. In the UTXO model, assets are discrete private _notes_, not public account balances. A note's contents (amount, owner, asset type) are hidden behind a commitment hash. Only the holder of the spending key can prove ownership.

This model has a property the account model lacks: ownership conditions can be arbitrarily complex. A note's owner does not have to be a single key. It can be a time-locked dual-path condition: _this key can claim immediately, or this other key can claim after a timeout_. The EVM account model has no native equivalent. Notes are not tethered to the account abstraction at all.

The question is whether we can use this richer ownership model to build crosschain atomic settlement. A note is just a commitment with an associated spending condition, and spending conditions can encode whatever logic we need.

The protocol starts from a symmetric setup: a shielded UTXO pool on each network, one for each asset being exchanged.

![Two shielded pools](/assets/images/2026-03-05-private-crosschain-swap-part-1/2-shielded-pools.png)

Alice holds USD notes on Network 1. Bob holds bond notes on Network 2. They want to swap: Alice pays USD, Bob delivers bonds, atomically and privately. Each party will lock a note for the counterparty on their home chain.

The core note structure is the same as the single-chain protocol (commitment, nullifier, owner key, salt), with two additions we will come back to:

```
Note {
    chainId:       uint256   // Binds the note to a specific network
    value:         uint64    // Amount
    assetId:       bytes32   // USD, BOND, etc.
    owner:         bytes32   // Primary spending key
    fallbackOwner: bytes32   // Original sender (refund path)
    timeout:       uint256   // When the fallback becomes valid
    salt:          bytes32   // Blinding factor
}
```

The `fallbackOwner` and `timeout` fields will make sense once we explain what can go wrong. For now, the question is how Alice and Bob claim each other's locked note.

### The coordination problem

In the single-chain shielded pool protocol, after a private transfer the sender attaches an encrypted memo: the note's contents encrypted for the recipient's viewing key. The recipient scans on-chain events, decrypts memos, and discovers their new notes.

A natural extension to crosschain swaps: Alice locks a note for Bob on Network 1 and sends him an encrypted memo with the salt. Bob locks a note for Alice on Network 2 and sends her an encrypted memo with his salt. Each party needs the other's salt to reconstruct the commitment and generate a claim proof.

But there is a fatal coordination problem. For Alice to claim the bond note on Network 2, she needs Bob's salt. For Bob to claim the USD note on Network 1, he needs Alice's salt. They each need to reveal a secret to let the other claim. This is exactly the HTLC problem in another form: one party always moves second.

If Alice reveals her salt first, Bob can claim the USD immediately, and then choose whether to reveal his salt for Alice to claim the bond. He can defect. If Bob reveals first, Alice has the same option. No cryptographic primitive can force two parties to commit to opening secrets at the same instant across two separate networks with no shared clock. You need a coordination mechanism.

### A coordinator that cannot steal

A Trusted Execution Environment (TEE) is a hardware-isolated process: the operator of the machine it runs on cannot read its memory or alter its code. The enclave runs a specific, auditable program and produces an attestation (a cryptographic certificate) that any third party can verify to confirm the expected code is running. Part 2 goes deep on how attestation works and what its real limits are. For now, treat it as a black box: a process whose behavior is determined by its code, not by whoever deployed it.

This makes a TEE a good Schelling point. Both parties can agree to use it without trusting the operator, because the attested code is the contract.

The obvious first use: both parties encrypt their salts for the TEE, the TEE decrypts both, verifies that the locked notes match the agreed terms on-chain, and delivers each party's salt to the other. Simultaneous revelation, no intermediary.

But this has a serious flaw. If Alice sends her note's salt to the TEE, the TEE has everything it needs to compute the nullifier and generate a claim proof. It can spend Alice's note itself. The shielded pool's guarantee is that only the spending key holder can spend a note. We cannot weaken that by handing anyone the spending secret, even an attested enclave.

The TEE can coordinate, but it must not be able to steal.

### Stealth addresses

The insight that unblocks this is stealth addresses.

Instead of locking notes to the counterparty's known spending key, each party locks their note to a fresh _one-time address_ that only the counterparty can derive, and that the TEE can publish without being able to use.

Each participant has two key pairs: a long-lived meta key pair `(sk_meta, pk_meta)` that is published, and a one-time ephemeral key pair generated per swap. The sender generates `(r, R = r·G)` and computes a shared secret with the counterparty's meta public key via ECDH:

```
shared_secret = r · pk_meta_counterparty
pk_stealth    = pk_meta_counterparty + H("stealth", shared_secret) · G
```

The stealth address `pk_stealth` is a one-time public key. An observer on-chain cannot link it back to `pk_meta_counterparty`. Only the holder of `sk_meta` can derive the corresponding spending key:

```
shared_secret = sk_meta · R        // R is public; sk_meta is secret
sk_stealth    = sk_meta + H("stealth", shared_secret)
```

The sender publishes `R` (the ephemeral public key) and a salt encrypted for the counterparty. The counterparty uses `R` and their `sk_meta` to derive the stealth spending key and decrypt the salt. No one else can.

The construction is symmetric: Alice generates `(r_A, R_A)`, computes `pk_stealth_B` from Bob's meta-key, and locks her USD note with `owner = pk_stealth_B` on Network 1. Bob does the same on Network 2 for Alice. Neither can claim the other's note directly: Alice does not have `sk_meta_B`, Bob does not have `sk_meta_A`.

Both parties then send the TEE `R_A`, `R_B`, and the encrypted salts. The TEE verifies that the two locked notes match the agreed swap terms on-chain, then publishes all four values in a single atomic transaction to the announcement contract.

What the TEE reveals is only public keys and ciphertexts: `R_A` and `R_B` are random curve points, the encrypted salts are random-looking byte strings. The TEE cannot derive `sk_stealth_A` or `sk_stealth_B` because those require `sk_meta_A` and `sk_meta_B`, which were never shared with anyone.

The worst the TEE can do is _refuse to publish_. It cannot steal. Push it further: assume a hardware manufacturer reads its memory. They see asset types, amounts, timing, and two meta public keys. Still no spending keys, still no way to move funds. And since `owner` is a private input to the ZK circuit, those key pairs have no on-chain footprint. What leaks is trade terms between two pseudonymous identifiers. Not nothing, but not actionable. Part 2 covers the full threat model: what hardware attestation actually proves, where it falls short, and what a multi-TEE setup adds.

The full protocol now has a third on-chain component: the announcement contract.

![Two shielded pools and TEE announcement contract](/assets/images/2026-03-05-private-crosschain-swap-part-1/2-shielded-pools-and-TEE.png)

Once the announcement is published, both parties read it, derive their stealth spending keys, reconstruct the note details from the decrypted salt, and submit claim proofs to their respective shielded pools. The protocol is symmetric: neither can claim without the announcement; once it is public, both can.

Atomicity holds because the TEE's announcement transaction is itself atomic. Both ephemeral keys are published together or not at all. Before the announcement, both notes are locked to stealth addresses that no one can spend. After it, both parties have everything they need.

### Fallback and timeout

This is where `fallbackOwner` and `timeout` come in. If the TEE never publishes (because the enclave crashed, went offline, or was censored), both parties need a way to reclaim their locked notes.

Each note carries the original sender as `fallbackOwner` and a `timeout` timestamp. After the timeout, the sender can spend the note back to themselves using the fallback path, without needing the TEE or the counterparty's cooperation. The TEE also validates that both timeouts match and are set to a reasonable window (typically 48 hours) before proceeding.

The protocol always terminates in one of two outcomes: both parties receive the other's asset, or both receive their own back. There is no stuck state, no capital locked indefinitely.

The fallback is symmetric by construction. If the TEE reveals, both parties can claim. If it does not reveal before the timeout, both refund. The TEE cannot selectively reveal one leg and withhold the other: the announcement contract requires both ephemeral keys together.

## How the pieces fit

The full data structure of the protocol:

| Component                 | Description                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Shielded pool (Network 1) | Commitments and nullifiers for stablecoin notes                                        |
| Shielded pool (Network 2) | Commitments and nullifiers for bond token notes                                        |
| Announcement contract     | Records the TEE's atomic revelation                                                    |
| Note                      | `{chainId, value, assetId, owner (stealth addr), fallbackOwner, timeout, salt}`        |
| TEE                       | Verifies both locked legs on-chain; publishes `R_A`, `R_B`, encrypted salts atomically |

What the protocol hides: amounts, asset types, counterparty identities, the link between the two locked notes.

What the protocol leaks: that a time-locked note exists on each chain, and approximately when the swap window closes. After settlement, both parties can spend their claimed notes into fresh standard notes to rejoin the general anonymity set.

Each component has one job: ZK circuits verify note formation and ownership, shielded pools prevent double-spending, and the TEE makes revelation atomic across chains. These are independent concerns handled by independent mechanisms.

For an interactive walkthrough of the full protocol flow — from setup through lock, TEE verification, atomic reveal, and claim/refund — see the [TEE Swap Protocol visual guide](/tee-protocol-page).

---

In [Part 2](/private-crosschain-atomic-swaps-tee-part-2/), we go inside the TEE. What does attestation actually prove? What are the real attack surfaces? Why AWS Nitro? We'll work through the threat model and walk through what the demo logs show.

The full implementation is open source, with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/approach-private-trade-settlement/tee_swap/SPEC.md).
