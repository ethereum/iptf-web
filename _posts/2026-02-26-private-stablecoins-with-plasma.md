---
layout: post
title: "Building Private Transfers on Ethereum with Plasma"
description: "Explore how ZK-plasma enables private stablecoin transfers on Ethereum. Covers off-chain execution, balance proofs, and deployment tradeoffs for institutions."
date: 2026-02-26 09:00:00 +0100
author: "Aaryamann"
image: /assets/images/2026-02-26-private-stablecoins-with-plasma/hero.png
tags:
  - private-transfers
  - plasma
  - intmax
  - ethereum
  - proof-of-concept
---

In a [recent post](/building-private-transfers-on-ethereum/), we built a shielded pool for private stablecoin transfers on Ethereum L1. The approach works: KYC-gated entry, UTXO commitments, dual-key architecture for selective disclosure. But every transfer writes new commitments and nullifiers to the chain. The pool contract's state grows with every transaction, and every state transition requires on-chain ZK proof verification.

What if the chain stored almost nothing? Rather than iterating on the shielded pool design, we explored a fundamentally different approach.

We built a proof-of-concept using [Intmax2](https://eprint.iacr.org/2025/021), a stateless ZK-plasma protocol, that runs private ERC-20 deposits, transfers, and withdrawals end-to-end against an Ethereum L2 testnet. Transaction details never touch the chain. Only block commitments (Merkle roots of hashed transaction batches), sender public keys, and aggregated BLS (Boneh-Lynn-Shacham) signatures are posted on-chain. Users hold their own balance proofs locally.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/pull/19), with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-payment/plasma/SPEC.md).

## Plasma, Revived

In 2017, Vitalik Buterin and Joseph Poon proposed [plasma](https://ethereum.org/developers/docs/scaling/plasma/) as a scaling solution where child chains post only block headers to Ethereum L1. The promise: massive throughput at minimal on-chain cost. Several variants followed, including Plasma MVP and Plasma Cash, each attempting different tradeoffs on data structure and exit complexity.

None succeeded. The core problem was data availability: if the operator withheld transaction data, users could not prove their balances to exit safely. The resulting "exit game," a challenge-response protocol for disputed withdrawals, was complex, slow, and UX-hostile. Rollups solved data availability differently by posting full transaction data on-chain, and effectively replaced plasma for general computation.


**ZK-plasma** is a scaling architecture where transaction execution happens entirely off-chain, with only compact cryptographic commitments posted to Ethereum. Users hold their own balance proofs locally and can withdraw funds at any time by presenting a zero-knowledge proof of their balance, without relying on any operator to store or reveal transaction data.

[Intmax2](https://eprint.iacr.org/2025/021) revives plasma by removing the data availability requirement entirely. Instead of relying on the operator to store and reveal data, each user holds their own balance proof locally. The operator (called a block builder) is stateless: it aggregates transaction hashes into a Merkle tree, posts the root on-chain with an aggregated BLS signature, and discards the data. If the operator disappears, users still hold everything they need to prove their balances and withdraw. Recursive ZK proofs ([Plonky2](https://github.com/0xPolygonZero/plonky2)) replace the old exit game: users prove their balance cryptographically instead of relying on challenge-response disputes.

## How Private Transfers Work

### Deposits

Deposits convert public ERC-20 tokens into a private balance on the plasma chain. The user locks tokens in a Liquidity contract on L1. The contract relays deposit data to the Rollup contract on the L2 via a cross-chain messenger. The Rollup contract inserts the deposit into its Merkle tree, and the validity prover asynchronously generates a proof for the new block state. The user polls until the deposit is confirmed, then updates their local balance proof.

In the target architecture, deposits are gated by an attestation registry: a ZK proof of Merkle inclusion in an on-chain KYC attestation tree, identical in concept to the [shielded pool's approach](/building-private-transfers-on-ethereum/). The [attestation registry](https://github.com/ethereum/iptf-pocs/pull/15) from the shielded pool PoC can be reused here with minimal modification; the core mechanism is the same.

The attestation proof is zero-knowledge: the on-chain verifier learns only that the depositor holds a valid, non-expired KYC attestation. It does not learn which attestation leaf was used, which compliance authority issued it, or when the attestation was granted. An observer sees that someone deposited a known amount of a known token, but cannot determine who deposited it or which compliance authority verified them.

![Deposit Flow](/assets/images/2026-02-26-private-stablecoins-with-plasma/deposit.png)

*Deposit flow: tokens lock on L1, relay to the Rollup contract on L2, and the user updates their local balance proof after the validity prover confirms the block.*

### Private Transfers

This is the core operation. The sender constructs a transaction batch (a mapping of recipients to amounts), hashes it with a random salt, and sends only the hash to a block builder. The builder collects hashes from multiple senders, constructs a Merkle tree, and sends each sender the tree root with their inclusion proof. Each sender verifies their proof and BLS-signs the commitment along with the aggregator's identity and replay-protection metadata. The builder aggregates all signatures into a single compact signature and posts the block to the Rollup contract.

The block builder never sees transaction contents, only salted hashes. It cannot determine who is paying whom or how much.

After the block is posted, the sender generates a recursive ZK validity proof attesting to sufficient balance, encrypts it with the transaction details, and stores it in the store vault. The recipient retrieves and decrypts the data using their viewing key.

The zero-knowledge property here is precise: the recipient learns only the sender's identity, the amount, and that the sender had sufficient balance at the time of the transfer. They learn nothing about the sender's total balance, other recipients in the sender's transaction batch, or what any other sender in the block was doing. The sender list (public keys) for each block is visible on-chain, so observers can see *who* participated as senders, but not *what* they sent or to *whom*.

![Transfer Flow](/assets/images/2026-02-26-private-stablecoins-with-plasma/transfer.png)

*Transfer flow: the block builder only sees salted hashes. After the block is posted, the sender encrypts the transaction details for the recipient via the store vault.*

### Withdrawals

Withdrawals convert a private plasma balance back to public L1 tokens. The user constructs a transfer targeting an L1 address, which signals withdrawal intent and goes through the normal transfer protocol. Once the block is proven by the validity prover, the user submits a withdrawal claim to the Withdrawal contract with a ZK balance proof. The contract verifies the proof, deducts any previously withdrawn amounts, and transfers tokens to the L1 address.

![Withdraw Flow](/assets/images/2026-02-26-private-stablecoins-with-plasma/withdraw.png)

*Withdrawal flow: the user proves their balance via a ZK proof and claims tokens on L1.*

## Developer Experience

The Intmax2 Rust SDK has clean API boundaries between proof generation, balance tracking, and encrypted store vault backup. Each component is pluggable: the proof backend, storage layer, and contract interaction can be replaced independently. The deposit-transfer-withdraw cycle runs without requiring the developer to touch recursive proof internals or key management directly.

## Self-Hosted vs. Public Network

Intmax2 supports two deployment models: a private instance where the institution controls all infrastructure, or the public Intmax network where the protocol team operates block builders and store vaults.

| Dimension | Private Instance | Public Network |
| --- | --- | --- |
| Compliance control | Full; institution sets attestation rules, KYC policy, revocation procedures | Shared; subject to Intmax's compliance framework |
| Anonymity set | Limited to institution's users | Broader, shared across all network participants |
| Infrastructure cost | High; block builders, store vaults, validity prover | None; protocol team operates everything |
| Metadata exposure | Controlled; institution runs its own store vaults | Store vault operator sees access patterns (no PIR) |
| Protocol upgrades | Institution controls upgrade cadence | Subject to Intmax governance decisions |

For a pilot or proof-of-concept, the public network minimizes operational overhead. For production deployments with regulatory obligations, where the institution needs to control who can transact, what compliance rules apply, and how data is stored, a private instance provides that control at the cost of running and maintaining the full infrastructure stack.

## Compliance and Threat Model

Privacy here enables compliance, not the opposite:

- **Attestation-gated entry.** Deposits require a ZK proof of KYC verification before funds enter the system, supporting obligations under the Bank Secrecy Act and [MiCA](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)'s stablecoin provisions.
- **Selective disclosure.** Viewing keys give regulators read-only access to a specific participant's full transaction history without exposing other users, supporting [GDPR](https://gdpr-info.eu/art-25-gdpr/)'s data minimization principle.
- **Separated authority.** The dual-key architecture (spending key for transfers, viewing key for audits) maps directly to how banks separate operational authority from audit access.
- **Travel Rule support.** The store vault's encrypted data model enables counterparty information sharing between institutions as required by [FATF Recommendation 16](https://www.fatf-gafi.org/en/publications/Fatfrecommendations/update-Recommendation-16-payment-transparency-june-2025.html), without exposing that data to public observers.

The threat model in brief:

- **Public observer:** sees block commitments, sender public keys, and deposit/withdrawal amounts; cannot link senders to recipients or determine transfer amounts within a block.
- **Malicious block builder:** can delay or censor transactions but cannot steal funds or read transaction contents. Users can switch builders or run their own.
- **Compromised store vault:** operator learns access patterns (who queries when) but cannot decrypt data.
- **Compromised viewing key:** leaks one user's full history without granting spending authority.

The [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/private-payment/plasma/SPEC.md) documents mitigations for each adversary class in detail.

## Limitations

This PoC demonstrates the full deposit-transfer-withdraw flow against a live testnet. It is not production-ready. The following limitations are real constraints for institutions evaluating this approach.

**No Private Information Retrieval on store vaults.** The store vault holds encrypted transaction data, but the server sees access patterns: which users query which topics, and when. No PIR is employed. An adversary controlling the store vault can correlate access timing with on-chain events. On a private instance, the institution controls the vault, limiting exposure. On the public network, this is a meaningful privacy gap. Mitigation: run your own store vault, or await PIR integration.

**Compliance tradeoff on the public network.** Using the public Intmax network means the institution does not control who else transacts on the system. The institution must comply with whatever AML framework Intmax defines, rather than enforcing its own. For institutions with strict counterparty screening or jurisdictional requirements, this creates regulatory friction. A private instance avoids this entirely.

**Protocol maturity.** Intmax2 is a live protocol, not a battle-tested production system. The cryptographic primitives (Plonky2, BLS aggregation, Poseidon hashing) are well-studied, and the protocol's fund safety property has been [formally verified in Lean](https://eprint.iacr.org/2025/021). But the full stack, including block builders, store vaults, validity provers, and deposit/withdrawal contracts, has not undergone years of adversarial testing. Smart contract audits remain a prerequisite for institutional deployment.

**Centralization in current deployment.** Block builders and store vaults are operated by the Intmax team. The protocol is designed for permissionless operation, and anyone can run a block builder, but the ecosystem has not decentralized yet. A single operator failure or policy change could disrupt the network. This mirrors early rollup centralization: a known issue with a clear path forward, not yet realized.

**Client-side proof generation.** Recursive ZK proof generation (Plonky2) is computationally intensive. The SDK targets desktop and server environments. For institutional back-office systems this is acceptable; for customer-facing mobile wallets it may not be.

**Viewing key compromise.** A compromised viewing key leaks all historical transaction data for that user, with no rotation mechanism. Same limitation as the shielded pool approach.

None of these are fundamental blockers. Each has a known mitigation path, but they are real constraints for any institution evaluating this approach today.

## What Comes Next

On the proving layer, [PlasmaBlind](https://pse.dev/mastermap/ptr) is an emerging alternative to the traditional recursive SNARK approach used here. Built on [folding schemes](https://sonobe.pse.dev/) (IVC-based recursion) instead of Plonky2, it is under active R&D by PSE and offers efficiency improvements to the balance proof pipeline.

Private transfers are one layer of an institutional payment pipeline. Upcoming posts will tackle the pieces that connect transfers to real-world payment infrastructure: messaging standards like [ISO 20022](https://www.iso20022.org/) for structured payment data, off-chain coordination for settlement finality, and the full end-to-end pipeline from payment initiation to settlement confirmation.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/pull/19). The [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/private-payment/plasma/SPEC.md) covers every protocol flow, data structure, and security consideration in detail. The [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/private-stablecoins.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-private-payments.md) documents on the IPTF Map provide additional context. Pull requests are welcome.
