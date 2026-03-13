---
layout: post
title: "Private Crosschain Atomic Swaps (Part 2 of 2)"
description: "How a Trusted Execution Environment (TEE) can coordinate private crosschain atomic swaps today, what the real attack surfaces are, and why TEEs are a practical bridge to stronger cryptographic solutions."
date: 2026-03-12 10:00:00 +0100
author: "Yanis"
image: /assets/images/2026-03-05-private-crosschain-swap-part-1/hero.png
tags:
  - atomic-swap
  - crosschain
  - tee
  - nitro-enclaves
  - proof-of-concept
---

In [Part 1](/private-crosschain-atomic-swap-part-1/), we built a protocol for private crosschain settlement. Shielded UTXO notes on two chains hide amounts and asset types. Stealth addresses let each party lock a note that only the counterparty can claim, without revealing who that counterparty is on-chain. A fallback timeout guarantees that if anything goes wrong, both parties reclaim their own funds.

The remaining problem is coordination. Each party holds a secret (an ephemeral key and an encrypted salt) that the other needs to claim. Revealing these secrets must happen simultaneously, otherwise whoever goes first can be cheated, whoever goes second can defect. We left the coordinator as a black box. This post opens it.

## What is a TEE?

A Trusted Execution Environment (TEE) is an isolated area inside a processor where code runs without the host machine, its operating system, or the cloud provider being able to read the memory. Think of it as a locked glass room inside a data center: anyone can watch the room being built and verify the blueprints, but once the door closes, nobody outside can see or touch what happens inside. The program runs, produces outputs, and the room is torn down. The operator never gets a key.

In our protocol, the TEE is the coordinator. It receives secrets from both swap parties, checks them against on-chain data, and publishes the claim keys. Because the enclave's memory is isolated, the operator running the machine cannot read the swap details passing through it.

For this proof of concept, we use [AWS Nitro Enclaves](#ref-2), a stripped-down virtual machine with no persistent storage, no network interface, and no interactive shell. The Nitro hypervisor walls it off from the host instance. Communication happens only through a narrow, pre-defined channel (a [vsock](https://man7.org/linux/man-pages/man7/vsock.7.html)). TEEs are already used in production in the Ethereum ecosystem, including by [Flashbots](https://writings.flashbots.net/block-building-inside-SGX) for MEV-Share and block building, and by several bridge protocols for cross-chain message verification.

[Intel SGX](#ref-1) places the trust boundary at the silicon: the cloud provider's software stack is excluded from the trusted computing base, though the chip vendor and physical access remain attack vectors (see [tee.fail](https://tee.fail)). Nitro places the trust boundary at the hypervisor: AWS's Nitro hypervisor is in the trusted computing base, but the isolation model is simpler and avoids the side-channel attack surface that has historically affected SGX. If your threat model excludes the cloud provider, Nitro is the simpler option. If it includes the cloud provider, chip-level isolation (SGX, AMD SEV) narrows the trust surface, but does not eliminate it.

#### TEEs are not HSMs

Institutions are used to Hardware Security Modules (HSMs) for key storage and signing. An HSM is a physically tamper-resistant vault (Common Criteria EAL5–7) with dedicated silicon and minimal firmware. It stores keys and tightly controls export. A TEE is logical isolation on a general-purpose processor (EAL2–4). It can run arbitrary code, but it lacks physical tamper resistance and has a larger attack surface. TEEs complement HSMs; they do not replace them. The question is not whether a TEE is "as secure" as an HSM — they solve different problems. The relevant question is: what happens when the TEE fails?

### TEE trust model

TEEs give you code isolation, remote attestation, and no persistent storage. What they do not give you is a cryptographic guarantee. A ZK proof holds even if every participant is adversarial. A TEE's confidentiality depends on the hardware vendor not being compromised and the firmware not having exploitable bugs. There is no way to verify either of those after the fact.

This does not make TEEs unusable, but it means the gaps are real and need more research:

- **Hardware manufacturer compromise.** The chip vendor could theoretically read everything inside the enclave. There is no cryptographic defense against this. Multi-vendor deployments reduce single-vendor risk but do not eliminate it.
- **Firmware or side-channel bugs.** [Spectre](https://spectreattack.com/), [Foreshadow](#ref-4), and similar attacks have historically let an attacker on the same machine extract enclave memory. The class of vulnerability is not eliminated by any TEE architecture.
- **I/O manipulation.** The host operator controls the network path into and out of the enclave. With a correctly established TLS session, they cannot read or alter encrypted traffic. But they can selectively deny service: dropping connections, refusing to relay outputs, or blocking specific clients. The enclave's computation is protected, but its availability is not.
- **No post-hoc verification of privacy.** Attestation proves the right code is running. It does not prove nobody watched. You cannot verify that a malicious operator did not observe your inputs during execution.

For institution-to-institution bilateral settlement, both parties know each other, have contractual recourse, and can audit the enclave code and attestation. In this setting, TEEs reduce the trust surface without requiring new cryptographic breakthroughs. They fill the gap today, and the coordinator can be swapped out when stronger primitives mature.

### How clients verify the enclave

Before submitting anything to the coordinator, each party needs assurance that the code running inside the enclave is exactly the open-source coordinator, unmodified and unobserved by the operator. This is the job of remote attestation.

![Remote attestation flow](/assets/images/2026-03-12-private-crosschain-swap-part-2/diagram-1-attestation-flow.png)

The build process is deterministic. The coordinator binary, its configuration, and its dependencies are packaged into an image. A build tool hashes everything in that image into a set of measurements (fingerprints of the code, configuration, and boot chain). These measurements are public: anyone can rebuild the image from source and verify they get the same hash.

When the enclave boots, it generates a fresh encryption key pair (no key material persists across reboots). It then asks the Nitro Security Module (NSM) — a dedicated chip on the host card, not a general-purpose HSM — to sign a certificate binding that public key to the enclave's measurements. The hardware module's signature chains to the cloud provider's root certificate, which is publicly verifiable.

When a client connects, the TLS handshake presents this certificate. The client checks three things: the signature chain is valid (the certificate was issued by the hardware module, which chains to the provider's root), the measurements match the expected enclave image (the code is what it claims to be), and the encryption key in the certificate is the one the enclave actually holds (the session is not being intercepted). If all three checks pass, the encrypted channel terminates inside the attested code. The operator cannot read the traffic.

## Inside the coordinator

The coordinator's job is narrow: receive submissions from both parties, verify that their locked notes match the agreed swap terms, and publish the claim secrets atomically.

![TEE coordinator architecture](/assets/images/2026-03-12-private-crosschain-swap-part-2/diagram-2-tee-coordinator.png)

### What the coordinator receives

Each party submits a swap identifier, a nonce, their ephemeral public key, an encrypted salt, and the plaintext details of the note they locked. The coordinator never receives any spending key. It gets public keys and note metadata, nothing that could be used to move funds.

### Hash-only verification

The core design choice: the TEE performs no cryptographic operations on swap data beyond hashing. All the expensive math (stealth address derivation, shared secret computation, salt encryption) was already proven correct inside the ZK circuit and verified on-chain when each party locked their note.

The ZK circuit includes four binding commitments as public inputs to the proof (verified on-chain alongside the note commitment):

```
h_swap = Hash(swap_id, salt)
h_R    = Hash(eph_pk)
h_meta = Hash(meta_pk_counterparty, salt)
h_enc  = Hash(encrypted_salt)
```

These commitments are recorded on-chain when the lock transaction is verified. They are sealed envelopes: the ZK proof guarantees the values inside are consistent with the stealth address derivation, but the values themselves are not revealed on-chain.

The coordinator opens these envelopes. For each party, it recomputes the hashes from the submitted plaintext and checks that they match what was recorded on-chain. Eight hash comparisons per swap, plus commitment and swap ID recomputation. If any check fails, the coordinator rejects the swap.

### Atomic revelation

Once both submissions are verified, the coordinator posts a single transaction to the announcement contract containing both ephemeral public keys and both encrypted salts. The contract enforces that each swap ID can only be announced once, preventing replays. An observer sees a swap ID, two random-looking values, and two encrypted values. They learn that a swap was announced, but not the amounts, asset types, chains, or participant identities.

After the announcement, both parties read the on-chain data, derive their stealth spending keys, decrypt the salt, reconstruct the counterparty's note, and submit a claim proof. If the announcement never happens, the timeout expires and both parties reclaim their own funds through the fallback path.

## Running the demo

We ran the full protocol on Sepolia (L1) and Scroll Sepolia (L2) with pre-deployed contracts on both networks. Alice holds USD notes on Sepolia, Bob holds bond notes on Scroll, and they want to swap atomically and privately.

The demo walks through four phases. First, Alice and Bob each receive a funded note on their respective chain (standard shielded UTXO commitments with no link to the recipient's identity). Second, both parties agree on swap terms off-chain, derive a deterministic swap ID, and lock their notes to stealth addresses. At this point, each party generates a ZK proof (around 9 KB) that the lock is correctly formed. Third, both parties submit their secrets to the coordinator over the attested encrypted channel. The coordinator verifies the binding commitments against on-chain data and, once both sides check out, posts the announcement transaction. Fourth, both parties read the announcement, derive their claim keys, and submit claim proofs. Alice ends up with bond notes on Scroll; Bob ends up with USD notes on Sepolia.

The full demo output (with links to every on-chain transaction on Sepolia and Scroll explorers) is available as a [gist](https://gist.github.com/Meyanis95/93c01b2d486489633655949997384483).

## Trust assessment

### What can go wrong

Atomicity is a TEE-level guarantee: the TEE must post both sides' data or neither. This cannot be enforced on-chain or by a SNARK. It is a behavioral property of the coordinator itself, and it opens three attack vectors.

**Selective disclosure.** A compromised coordinator could post only one party's claim secrets. Even if the announcement contract requires both sets in a single transaction and rejects a one-sided submission, the secrets are visible in the mempool before inclusion, so the information is already leaked. The victim can only fall back to the timeout refund on their own note, while the other party (or an attacker colluding with them) uses the leaked secrets to claim. This is not a liveness failure — it is effective theft enabled by breaking atomicity.

**Swap-ID griefing.** The swap ID is derived deterministically by both parties from the agreed swap terms. A malicious coordinator could announce garbage for a valid swap ID, permanently blocking that swap (since each ID can only be announced once). The counterparty's funds are not lost — the timeout refund still works — but the swap is killed.

**Liveness.** A single TEE instance is a single point of failure. If the enclave goes down, swaps stall until the timeout expires.

In the institution-to-institution setting, contractual recourse and mutual attestation auditing provide practical deterrents. An economic bond mechanism — where the TEE operator posts collateral that can be slashed on proof of asymmetric behavior — could strengthen these deterrents, but is not implemented in the current PoC.

### Protocol gaps

The shielded pool contracts must be deployed on every network where assets are traded. Each deployment starts with an empty Merkle tree and zero anonymity set. Growing that set takes time and volume.

Rollup finality constrains the protocol's timing parameters. Optimistic rollups (Optimism, Arbitrum) have a 7-day challenge window for full finality; ZK rollups (Scroll, zkSync) finalize in roughly 1–4 hours depending on proof generation and L1 inclusion. The lock timeout must exceed the slower chain's finality window to prevent a race where one party claims on a finalized chain while the other's chain reorgs.

The UTXO model requires custom wallet infrastructure: scanning for notes, decrypting memos, tracking nullifiers, managing Merkle proofs. None of this has standardized tooling today. The tooling cost is real.

During the lock window, time-locked notes are distinguishable from standard notes (they carry a non-zero timeout). This leaks the existence of a pending swap, though not the amounts, assets, or identities.

The coordinator trusts its RPC endpoint. A compromised RPC could feed false on-chain state. Running a light client like [Helios](https://github.com/a16z/helios) inside the enclave would fix this by verifying state proofs against the consensus layer directly. The announcement contract uses a simple externally owned account for the TEE signer; in production, a smart account ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) would support key rotation and censorship resistance.

### The ZK layer is the real guarantee

The ZK proofs verify note formation, ownership, and consistency. They hold regardless of who runs the coordinator. No one can forge notes, double-spend, or claim funds they do not own. The math enforces this even if the TEE is fully compromised.

The TEE is a courier. It checks that both parties revealed consistent secrets, but financial correctness comes from the SNARKs. A compromised TEE leaks swap details (amounts, counterparties) — a privacy breach, but not a theft. The integrity of individual notes is not at risk. What the TEE can break is atomicity: the guarantee that both sides settle or neither does. That is a coordination property, not a cryptographic one, and it is where this protocol is weakest.

### Have we removed counterparty risk?

Part 1 framed the problem as removing counterparty risk from crosschain settlement. The honest answer: partially.

The coordinator never holds funds. It cannot forge claims. Its code is publicly verifiable through remote attestation. If it goes down, the timeout refund kicks in. These are real improvements over a traditional settlement agent sitting between two counterparties.

But we replaced a custodian with three new trust assumptions: (1) the hardware vendor is not compromised, (2) the operator runs the attested code honestly, and (3) contractual recourse exists if either fails. The trust surface is smaller and more auditable, but it is not gone.

The shielded pool contracts are permissionless. Both parties to a swap can agree to use any coordinator — they can deploy their own announcement contract, run their own attested enclave, and operate independently. If a coordinator misbehaves, both counterparties can agree to move to a different one. The viewing key architecture from the [shielded pool design](/building-private-transfers-on-ethereum/) still applies: institutions grant viewing keys to regulators for selective disclosure, and the enclave has no persistent storage. These properties make the setup practical for bilateral institutional settlement. But "practical with contractual recourse" is not the same as trustless.

## Can we remove the coordinator?

The TEE coordinator is a starting point, not the destination. MPC could replace the single enclave with a threshold protocol, removing the hardware trust assumption at the cost of latency and operational complexity. FHE could let the coordinator verify encrypted submissions without decrypting, but remains orders of magnitude too slow.

The coordination problem reduces to this: two parties each hold private inputs (their ephemeral key and encrypted salt), and we need a single proof that both sets of inputs are consistent with the on-chain state. That is what co-SNARKs solve — each party contributes their secret inputs to a joint ZK proof without revealing them to anyone. The proof itself becomes the atomic revelation. If it verifies, both sides are consistent. No trusted intermediary, no hardware assumption, no coordinator to compromise. The coordinator becomes a protocol rather than a party.

Collaborative proving is early stage in terms of usage and development. But it is the actual solution to the problem we posed in Part 1: two private inputs, one proof, zero trust.

The full implementation is open source, with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/approach-private-trade-settlement/tee_swap/SPEC.md) and an [interactive protocol walkthrough](/tee-protocol-page).

## References

<span id="ref-1">**[1]**</span> V. Costan and S. Devadas, "Intel SGX Explained," Cryptology ePrint Archive 2016/086. [[PDF](https://eprint.iacr.org/2016/086.pdf)]
<span id="ref-2">**[2]**</span> AWS, "AWS Nitro Enclaves." [[Docs](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html)]
<span id="ref-3">**[3]**</span> S. Knauth et al., "Integrating Remote Attestation with Transport Layer Security," Intel, 2018. [[arXiv](https://arxiv.org/abs/1801.05863)]
<span id="ref-4">**[4]**</span> J. Van Bulck et al., "Foreshadow: Extracting the Keys to the Intel SGX Kingdom," USENIX Security 2018. [[PDF](https://foreshadowattack.eu/foreshadow.pdf)]
<span id="ref-5">**[5]**</span> Confidential Computing Consortium (Linux Foundation). [[Site](https://confidentialcomputing.io/)]
<span id="ref-6">**[6]**</span> O. Ozdemir and T. Boneh, "Experimenting with Collaborative zk-SNARKs: Zero-Knowledge Proofs for Distributed Secrets," Cryptology ePrint Archive 2021/1530. [[PDF](https://eprint.iacr.org/2021/1530.pdf)]
