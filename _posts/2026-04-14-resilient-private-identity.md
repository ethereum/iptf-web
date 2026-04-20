---
layout: post
title: "Resilient Plural Identity"
description: "Designing identity on Ethereum that survives issuer failure: plural attestation sources, vOPRF sybil resistance, and an on-chain trust anchor that no single party can revoke."
date: 2026-04-16 10:00:00 +0100
author: "Oskar, Aaryamann"
image: /assets/images/2026-04-14-resilient-private-identity/hero.png
tags:
  - identity
  - plural-identity
  - vOPRF
  - sybil-resistance
  - zero-knowledge
  - proof-of-concept
---

*This post opens our three-part resilience series on identity, payments, and coordination. Where previous IPTF writeups started from an institutional requirement and designed forward, these start from a failure mode (a sanctioned jurisdiction, a collapsed issuer, an internet shutdown) and work back to what Ethereum can offer. Expect the voice to shift accordingly.*

Self-sovereign identity is a user having the final say over who they are online, and over the status they carry into any system they join. Most coordination problems we care about, whether voting in a DAO, posting in a community forum, claiming aid from an NGO, or settling a regulated transaction, eventually need to answer a question about the person on the other side: are they real, are they unique, do they meet some criterion. Today that question is almost always answered by a single outside authority. A government issues a passport. A platform issues an account. A compliance vendor maintains a list. Identity is where self-sovereignty meets its hardest test, because dependence on that authority is the weak link.

We have run into this ourselves. The [shielded pool](/building-private-transfers-on-ethereum/) and [plasma chain](/private-stablecoins-with-plasma/) we built both gate entry behind a KYC attestation that participants prove via a zero-knowledge proof, with no identity revealed on-chain. The compliance gate works. It is also a single point of failure.

When that authority shuts down, gets sanctioned, or turns adversarial, already-verified people can no longer prove they were verified, and new people cannot onboard. The application is intact, the privacy layer is intact, and nobody can get through the front door. This is not a hypothetical edge case. Governments revoke digital IDs. Platforms deplatform. Email providers close accounts. Compliance vendors get acquired or dissolved. For a voter in a community decision, a recipient of humanitarian aid, a researcher on an adversarial platform, or an institution running regulated operations on Ethereum, losing the identity provider means losing agency over a status that was legitimately earned.

We built a proof-of-concept that removes this dependency. After a one-time enrollment, an on-chain Merkle root on Ethereum, censorship-resistant and always available, becomes the sole trust anchor. The identity provider can go offline, revoke everything, or turn adversarial. Holders keep proving attributes. New enrollees join through any accepted identity source, not just the original provider. Plurality is the default: no single issuer holds a monopoly over who gets to participate.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-identity/resilient-private-identity), with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-identity/resilient-private-identity/SPEC.md).

## How identity verification works today

The standard model for on-chain identity follows a three-step dependency chain:

1. An **issuer** (KYC provider, government agency, compliance authority) verifies a person's identity and signs a credential.
2. A **holder** presents that credential (or a ZK proof over it) to prove an attribute: age, nationality, sanctions-list status.
3. A **verifier** (smart contract, institution, dApp) checks the credential's validity, often by querying the issuer's revocation registry.

Every step depends on the issuer being live and cooperative. [ZKPassport](https://zkpassport.id/) verifies passport NFC signatures issued by governments. [Anon Aadhaar](https://github.com/anon-aadhaar) verifies Indian national ID signatures from UIDAI. [ZK Email](https://prove.email/) verifies DKIM signatures from email providers. [TLSNotary](https://tlsnotary.org/) verifies TLS session transcripts from web2 services. All of these produce strong cryptographic proofs of identity attributes. None of them answer the question: what happens when the entity behind the original credential disappears?

The issuer can fail in several ways. It can shut down (bankruptcy, sanctions, corporate dissolution). It can turn adversarial (mass-revoke credentials, publish false revocation lists, forge credentials for non-holders, refuse new issuance). It can simply go offline. In every case, the holder is left with a credential that cannot be independently verified.

![Traditional identity systems require the issuer to be online for every revocation check; resilient private identity replaces the issuer with an on-chain Merkle root as the sole trust anchor](/assets/images/2026-04-14-resilient-private-identity/resilient_identity_comparison.png)

## Breaking the issuer dependency

The protocol replaces the live issuer with two components: a threshold MPC (Multi-Party Computation) network that processes enrollments, where multiple independent operators each hold a share of a secret key and must cooperate above a threshold to produce a result, and an on-chain Merkle tree that is the permanent trust anchor. After enrollment, neither the MPC network nor the original identity source is needed for verification.

Each enrolled identity becomes a leaf in the tree. The leaf commits to the holder's secret and four attributes (age, nationality, name hash, enrollment timestamp) via [Poseidon](https://www.poseidon-hash.info/), a ZK-friendly hash function. The commitment hides every field behind the hash. An observer sees a 32-byte value in the Merkle tree and nothing else. The holder's secret authorizes proof generation. The attributes can be queried via ZK predicates later, without revealing the full set.

## What we mean by identity

Identity in this protocol is not one thing. It is whatever combination of signals an application is willing to accept: a passport for strong legal attestations, a national ID or email for web services, a social-graph vouch or an economic stake for forums and smaller communities. Each signal is partial. Strong signals (passport, national ID) are expensive for the verifier to accept because they pull in regulatory obligations, and expensive for the holder to produce because they require a cooperative government. Weak signals (email, social vouch) are cheap but easy to forge at scale.

A plural identity system treats these signals as composable rather than substitutable. A person can hold one identity for voting in a DAO, another for institutional transactions, a third for posting pseudonymously in a research forum, each one rooted in a different source. [Gitcoin Passport](https://passport.human.tech/) (now Human Passport) already works this way for sybil-resistant grant rounds, aggregating weak web2 and web3 signals into a combined score. Vitalik's [framework on zk-identity](https://vitalik.eth.limo/general/2025/06/28/zkid.html) argues the cost of holding N distinct identities should scale as N^2, so multiple pseudonyms remain achievable for people who legitimately need them, while mass-sybil attacks stay too expensive to be worth running.

In this view, sybil resistance is not bolted on top of identity. It is the property that makes plural identity economically coherent. The protocol below is one way to get that shape.

## Enrollment

Enrollment is a single on-chain transaction. The work before that transaction is what makes the protocol resilient. The holder proves identity ownership using an existing source (passport, national ID, email, web2 account), then obtains a deterministic sybil-resistant tag from a [vOPRF](https://www.rfc-editor.org/rfc/rfc9497) (verifiable Oblivious Pseudorandom Function) network: a cryptographic protocol that maps an input to a deterministic but unpredictable output using a secret key, without the key holder learning the input or the requester learning the key. The tag ensures one real-world identity maps to exactly one on-chain leaf, regardless of when enrollment happens. The holder generates a ZK proof binding everything together and submits it in a single transaction.

![Enrollment flow: the holder obtains identity evidence, blinds it, sends it to the vOPRF MPC network for evaluation with a link proof, then submits the enrollment proof and leaf to the on-chain contract](/assets/images/2026-04-14-resilient-private-identity/resilient_identity_flow.png)

After this transaction, the holder stores their secret and attributes locally. The issuer is no longer involved. Ethereum itself becomes the trust anchor: a censorship-resistant, permissionless ledger that no single party can take offline or tamper with. The smart contract with its ZK verifier is the resilient issuer.

## Verification

A verifier requests an attribute check: "prove `age_over_18 = 1`."

The holder generates a ZK membership proof demonstrating three things: they have a leaf in the tree, their committed attributes satisfy the predicate, and a scope-bound nullifier is correctly derived.

The nullifier is deterministic per holder and per verifier scope: the same holder always produces the same nullifier for the same verifier, preventing duplicate presentations within a single application. Across different verifiers, the nullifiers are unrelated. An observer who sees a proof submitted to Verifier A and another to Verifier B cannot determine whether the same holder produced both.

![Verification flow: the verifier requests an attribute proof, the holder generates a ZK membership proof, and the on-chain IdentityVerifier checks root freshness, nullifier uniqueness, and proof validity](/assets/images/2026-04-14-resilient-private-identity/resilient_identity_verification_flow.png)

The verifier calls `IdentityVerifier.verifyProof(...)`. The contract checks root freshness (last 1000 roots in a circular buffer), nullifier uniqueness, and proof validity. If the call does not revert, the proof is valid.

No issuer endpoint is contacted. No registry is queried. The on-chain root is the only external input. The verifier learns that the holder is enrolled and that the requested attribute predicate holds. The verifier does not learn who the holder is, when they enrolled, or any attribute not included in the query.

## Unlinkability

Two proofs from the same holder, one submitted to Verifier A and another to Verifier B, should look unrelated. No on-chain or off-chain observer should be able to tell they came from the same person. This is what separates useful private identity from tokenized surveillance. Most ZK identity systems fall short of it, either because the credential exposes a persistent identifier during presentation (the holder's pubkey, a hash that is deterministic across scopes), or because the issuer accumulates enough metadata during issuance to correlate later verifications back to a person.

This protocol targets unlinkability on two axes. Across verifiers, the scope-bound nullifier makes the same holder look unrelated to different applications. Across issuance and use, the vOPRF sits at the one point where the identity-source credential would otherwise become a correlation handle, so no single party, including any MPC subset below threshold, sees both sides of the mapping. This was the design goal behind [OpenAC](https://eprint.iacr.org/2026/251) and the motivating reason [TACEO](https://core.taceo.io/articles/taceo-oprf/) puts a vOPRF in the identity path. Without it, identity providers can still watch their users on-chain.

## Sybil resistance

A single cryptographic factor is not enough. If the identity source itself is compromised (unlimited burner emails, forged documents), an attacker can generate fake source identities that each pass the vOPRF legitimately. The cryptographic factor holds (one source identity, one leaf) but the source is a mint.

The protocol layers three independent factors:

| Layer | Mechanism | What it bounds | Assumption |
| --- | --- | --- | --- |
| **Cryptographic** | vOPRF enrollment nullifier | One leaf per source credential | Identity sources issue unique, unforgeable credentials |
| **Economic** | Refundable stake (default 0.1 ETH) | Capital lockup per leaf | Attacker capital is finite |
| **Social** (future) | Web-of-trust vouching (K=3 vouches, V=2 budget) | Amplification bounded by social reach | Social graph not fully captured by attacker |

When sources are honest, the cryptographic layer alone enforces one-to-one binding. When sources are compromised, the economic layer kicks in: N sybil leaves require N * 0.1 ETH locked. The stake is a refundable bond. Holders reclaim it by unstaking, which removes their leaf from the tree.

The social layer (specified in the [README](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-identity/resilient-private-identity#future-work-web-of-trust)) adds a third constraint: each existing member has a lifetime vouch budget of V=2, and new enrollees need K=3 vouches from existing members. Vouches are aggregated into a single recursive proof off-chain and submitted atomically with the enrollment transaction. No vouch graph is ever visible on-chain. An attacker with T fake identities creates at most 2T additional sybils. Growth is linear, not exponential.

These three factors match the plural-identity cost structure from earlier: one identity is cheap, ten cost ten times as much, a million are priced out of reach. The cryptographic factor binds each identity to a real credential. The economic factor prices the right to hold multiples.

## Compliance without the issuer

Institutions need more than cryptographic properties. They need to satisfy regulatory obligations. Here is how the protocol's privacy mechanisms map to specific compliance requirements.

**Attestation-gated enrollment.** In a [previous PoC](/building-private-transfers-on-ethereum/), we built KYC-gated deposits using an on-chain attestation registry: a Merkle tree of compliance attestations where depositors prove inclusion via ZK without revealing which attestation is theirs. The same mechanism gates enrollment here. A compliance authority attests that an identity source is valid, and the enrollee proves attestation inclusion alongside their enrollment proof.

**Selective disclosure.** The attribute commitment model supports scoped queries. A verifier can ask "is this person over 18?" without learning their nationality, name, or enrollment date. Only indices 0 (`age_over_18`) and 1 (`nationality`) are queryable in version 1. Name hash and enrollment timestamp are committed but non-queryable, designed to support GDPR data minimization principles, as required by [Article 25](https://gdpr-info.eu/art-25-gdpr/).

**Audit trails.** Every on-chain verification emits a `ProofVerified` event recording the nullifier, root, and external nullifier. Regulators with the verifier's application scope can reconstruct the audit trail of verification events without learning holder identities. This supports obligations under the [Bank Secrecy Act](https://www.fincen.gov/resources/statutes-and-regulations/bank-secrecy-act) and [MiCA](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica) record-keeping requirements.

**Surviving jurisdictional disruptions.** An institution in a sanctioned jurisdiction loses its KYC providers. Pre-enrolled employees continue proving attributes against the on-chain root. New enrollees use self-contained sources (passport NFC, email DKIM) via the vOPRF network. Verifiers see no disruption. This is the point of the whole exercise: identity continuity under conditions where traditional credential chains break.

## Architecture

| Layer | Tools |
| --- | --- |
| Circuits | [Noir](https://noir-lang.org/), [UltraHonk](https://github.com/AztecProtocol/barretenberg) |
| Contracts | Solidity, [Foundry](https://book.getfoundry.sh/), [LeanIMT](https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt) |
| Client | Rust, [Alloy](https://github.com/alloy-rs/alloy) |
| Hashing | [Poseidon](https://www.poseidon-hash.info/) (BN254), SHA-256 |
| OPRF | [RFC 9497](https://www.rfc-editor.org/rfc/rfc9497) vOPRF (threshold extension per [Jarecki et al.](https://eprint.iacr.org/2017/363)) |

Three [Noir](https://noir-lang.org/) circuits. `pi_link` proves the blinded OPRF request and identity commitment derive from the same user ID. The enrollment circuit verifies the vOPRF evaluation proof and constructs the Merkle leaf. The membership circuit proves tree inclusion with selective disclosure. All proofs use [UltraHonk](https://github.com/AztecProtocol/barretenberg) with a universal SRS from the Aztec Ignition ceremony, so there is no per-circuit trusted setup.

Three Solidity contracts. `IdentityTree` manages the incremental Merkle tree ([LeanIMT](https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt)). `Enrollment` gates tree insertion behind the enrollment ZK proof, manages the MPC public key with a 48-hour timelock, and enforces the refundable stake. `IdentityVerifier` checks membership proofs, enforces nullifier uniqueness, and restricts attribute queries to the two queryable indices.

A Rust client handles key derivation, identity source canonicalization, vOPRF interaction, proof generation, and contract calls via [Alloy](https://github.com/alloy-rs/alloy).

## Threat model

| Adversary | What they see | What they cannot do |
| --- | --- | --- |
| **Public observer** | Leaf commitments, enrollment nullifiers, verification events | Link a leaf to a holder's identity, extract attributes from commitments, link proofs across verifiers |
| **Malicious MPC node** (below threshold) | `(identity_commitment, blinded_request, IP, timestamp)` for enrollments it processes | Reconstruct the OPRF secret key, produce valid enrollment nullifiers for arbitrary identities, forge proofs |
| **Compromised `identity_secret`** | All historical nullifiers for that holder (by enumerating known external nullifiers from chain data) | Compromise other holders, modify committed attributes, reverse the enrollment |
| **Adversarial issuer** | Whatever they knew before turning adversarial | Revoke the ability of enrolled holders to generate proofs, invalidate the on-chain trust anchor, prevent new enrollments via the vOPRF network |

The critical boundary: after enrollment, the holder's ability to prove attributes depends only on `identity_secret` and the on-chain Merkle root. The issuer, the MPC network, and every other off-chain component can disappear without affecting existing holders.

## Limitations

This is a proof-of-concept with real limitations.

**Key loss is permanent.** There is no revocation mechanism. If a holder loses `identity_secret`, the leaf remains and the enrollment nullifier stays consumed. Production path: a revocation bitmap checked in-circuit alongside Merkle membership, with governance-gated enrollment nullifier clearing. In the interim, [Shamir secret sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) of `identity_secret` across trusted devices is recommended.

**Self-declared attributes.** Enrollees self-declare their attribute vector. The protocol does not verify attribute truthfulness on-chain. We scoped it this way for the PoC. The production path uses recursive per-source `pi_link` circuits that verify the identity proof inside the circuit and extract attributes directly from the source's cryptographic output (e.g., parsing age from an Anon Aadhaar proof, nationality from a ZKPassport proof).

**Predicate parameter leakage.** `predicate_type`, `predicate_attr_index`, `predicate_value`, and `predicate_result` are public inputs visible on-chain. With 2 queryable attributes (`age_over_18`: 2 values, `nationality`: ~249 values), the anonymity set ceiling is approximately 498 buckets. Repeated observations across verifiers narrow this further. Production path: universal predicate circuits where all predicate parameters are private inputs.

**Transaction graph linkability.** Without a relayer, the Ethereum transaction graph links enrollment to verification via address reuse or funding-source correlation. For any deployment claiming privacy, relayer infrastructure ([EIP-4337](https://eips.ethereum.org/EIPS/eip-4337) paymaster or purpose-built relay) is non-negotiable.

**BN254 security margin.** ~100-110 bits of classical security, below the 128-bit target. Driven by Ethereum precompile availability ([EIP-196](https://eips.ethereum.org/EIPS/eip-196)/[EIP-197](https://eips.ethereum.org/EIPS/eip-197)). Migration to BLS12-381 via [EIP-2537](https://eips.ethereum.org/EIPS/eip-2537) should be planned for production.

**MPC metadata accumulation.** Each MPC node sees `(identity_commitment, blinded_request, IP, timestamp)` per enrollment. Even below the collusion threshold, individual operators accumulate a census of enrollees. Timing correlation with on-chain enrollment events can link OPRF requests to specific leaves. Production path: Tor/mixnet for MPC communication, enforced data retention policies.

## Related work

Several projects tackle private identity on Ethereum from different angles. Here is where this protocol fits.

[Semaphore](https://semaphore.pse.dev/) (PSE) is the most established private membership proof system. Holders commit an identity to a Merkle tree and generate ZK proofs of membership with nullifiers. It provides the core primitive this protocol extends, but does not enforce sybil resistance at the identity layer: nothing prevents one person from inserting multiple commitments.

[World ID](https://worldcoin.org/world-id) takes the opposite approach: biometric enrollment via iris scan through a specialized device (the Orb) provides the strongest one-person-one-identity guarantee available. The tradeoff is hardware dependency and centralized enrollment infrastructure, which limits deployment to locations with physical Orb access.

[Self](https://self.xyz/), [ZKPassport](https://zkpassport.id/), and [Human](https://human.tech/) verify identity attributes and generate ZK proofs. Self and ZKPassport focus on passport NFC signatures on mobile. Human aggregates multiple identity signals into a unified score. All three produce strong per-session proofs and serve as viable enrollment sources for this protocol, with the vOPRF layer adding sybil resistance and issuer independence on top.

[zk-creds](https://eprint.iacr.org/2022/878) (Rosenberg et al., 2023) shares the Merkle-tree-as-issuance-list paradigm. Holders insert credentials into a public bulletin board and generate ZK proofs of possession. The approach works with existing identity documents without modification. The key difference is sybil resistance: zk-creds delegates duplicate prevention to the issuance list manager, while this protocol enforces it cryptographically via the vOPRF enrollment nullifier.

[zk-promises](https://eprint.iacr.org/2024/1260) (Shih et al., 2025) extends anonymous credentials with stateful callbacks: issuers can asynchronously update, suspend, or revoke credentials after issuance, enabling reputation systems and moderation for anonymous users. The design targets interactive platform use cases (downvotes, bans, reputation decay) rather than institutional identity attestation.

[OpenAC](https://eprint.iacr.org/2026/251) (EF/PSE) adds unlinkable presentations over existing verifiable credentials (SD-JWT, mDL) with transparent ZK proofs and no trusted setup, compatible with the EUDI Architecture Reference Framework. It assumes a cooperative issuer for credential issuance, which is the assumption this protocol is designed to remove.

[PLUME](https://aayushg.com/thesis.pdf) (ERC-7524) generates deterministic nullifiers from existing ECDSA keys, allowing Ethereum address holders to prove membership and prevent double-actions without new key material. It reuses existing keys (no enrollment ceremony) but does not support attribute predicates or identity-layer sybil resistance.

[TACEO](https://core.taceo.io/articles/taceo-oprf/) already runs a distributed threshold vOPRF in production using MPC across 13 globally distributed servers. Their roadmap explicitly targets preventing identity issuers from tracing on-chain usage by verified individuals. This is the same problem we are working on from the enrollment side, and their infrastructure is a natural deployment target for the vOPRF network this protocol requires.

The [privacy-ethereum/zkspecs](https://github.com/privacy-ethereum/zkspecs) repository has complementary specs for [ZK-based human verification](https://github.com/privacy-ethereum/zkspecs/tree/main/specs/5) and [age eligibility proofs](https://github.com/privacy-ethereum/zkspecs/pull/19). Both address how to prove credential possession without disclosing personal attributes, which is the same separation of verification from disclosure that this design is built around.

## What comes next

The immediate extensions are multi-source identity integration (recursive verification of existing identity proof systems inside Noir, so attributes are cryptographically verified rather than self-declared and sybil resistance works across identity sources), web-of-trust vouching as a third sybil factor, and epoch-based key rotation for forward secrecy.

The [specification](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-identity/resilient-private-identity/SPEC.md) covers every circuit constraint, data structure, and security consideration. The [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/resilient-identity-continuity.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-private-identity.md) documents on the IPTF Map show how this fits into the broader institutional privacy work. Pull requests are welcome.
