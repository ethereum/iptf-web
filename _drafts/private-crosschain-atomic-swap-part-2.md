---
layout: post
title: "Private Crosschain Atomic Swaps (Part 2 of 2)"
description: "Inside the TEE coordinator: how a Trusted Execution Environment makes crosschain atomic swaps work today, what the real attack surfaces are, and why TEEs are a bridge to stronger cryptographic solutions."
date: 2026-03-12 10:00:00 +0100
author: "Yanis, Aaryamann"
image: /assets/images/2026-03-05-private-crosschain-swap-part-1/hero.png
tags:
  - atomic-swap
  - crosschain
  - tee
  - nitro-enclaves
  - proof-of-concept
---

In [Part 1](/private-crosschain-atomic-swap-part-1/), we built a protocol for private crosschain settlement. Shielded UTXO notes on two chains hide amounts and asset types. Stealth addresses let each party lock a note that only the counterparty can claim, without revealing who that counterparty is on-chain. A fallback timeout guarantees that if anything goes wrong, both parties reclaim their own funds.

The remaining problem is coordination. Each party holds a secret (an ephemeral key and an encrypted salt) that the other needs to claim. Revealing these secrets must happen simultaneously: whoever goes first can be cheated, whoever goes second can defect. We left the coordinator as a black box. This post opens it.

## What is a TEE?

A Trusted Execution Environment (TEE) is a hardware-isolated area inside a processor where code runs without the host machine, its operating system, or the cloud provider being able to read the memory. Think of it as a locked glass room inside a data center: anyone can watch the room being built and verify the blueprints, but once the door closes, nobody outside can see or touch what happens inside. The program runs, produces outputs, and the room is torn down. The operator never gets a key.

In our protocol, the TEE is the coordinator. It receives secrets from both swap parties, checks them against on-chain data, and publishes the claim keys. Because the enclave's memory is isolated, the operator running the machine cannot read the swap details passing through it.

For this proof of concept, we use AWS Nitro Enclaves, a stripped-down virtual machine with no persistent storage, no network interface, and no interactive shell. The Nitro hypervisor walls it off from the host instance. Communication happens only through a narrow, pre-defined channel (a vsock).

### How Nitro differs from SGX

Intel SGX encrypts enclave memory at the chip level, so even the cloud provider operating the physical machine cannot read it. Nitro Enclaves rely on the hypervisor boundary instead: the isolation is logical, not cryptographic at the hardware level. The trade-off is straightforward. SGX protects against the cloud provider; Nitro trusts the cloud provider (AWS) but offers a simpler operational model with fewer side-channel attack surfaces. If you already trust your cloud provider with your infrastructure, Nitro is the simpler option. If you need protection _from_ the cloud provider, chip-level encryption (SGX, AMD SEV) is required.

### TEEs are not HSMs

Institutions are used to Hardware Security Modules (HSMs) for key storage and signing. An HSM is a physically tamper-resistant vault (Common Criteria EAL5–7) with dedicated silicon and minimal firmware. It stores keys and never exports them. A TEE is logical isolation on a general-purpose processor (EAL2–4). It can run arbitrary code, but it lacks physical tamper resistance and has a larger attack surface. TEEs complement HSMs; they do not replace them. The question is not whether a TEE is "as secure" as an HSM — they solve different problems. The relevant question is: what happens when the TEE fails?

### Where TEEs break

The failure modes matter:

- **Hardware manufacturer compromise.** The chip vendor could theoretically read everything inside the enclave. There is no cryptographic defense against this. Multi-vendor deployments reduce single-vendor risk but do not eliminate it.
- **Firmware or side-channel bugs.** Spectre, Foreshadow, and similar attacks have historically let an attacker on the same machine extract enclave memory. The class of vulnerability is not eliminated by any TEE architecture.
- **I/O manipulation.** The host operator controls every byte going into and out of the enclave. They can feed false data, withhold outputs, or selectively censor. The enclave's memory is protected, but its communication channel is not.
- **No post-hoc verification of privacy.** You can use a ZK proof to verify that a function was executed correctly (the math holds regardless of who ran it). But you cannot verify that a malicious operator did not observe your inputs during execution. Attestation proves the right code is running. It does not prove nobody watched.

### TEEs are not a substitute for cryptography

A ZK proof is a mathematical guarantee: it holds even if every participant is adversarial. A TEE's confidentiality depends on the hardware vendor not being compromised and the firmware not having exploitable bugs. There is no way to verify either of those after the fact.

The scenario we are exploring is institution-to-institution bilateral settlement. Both parties know each other, have contractual recourse, and can audit the enclave code and attestation. In this setting, TEEs are a practical trust-minimization tool. Designing for an end-user-to-institution setting would require a different threat model with stronger guarantees (and likely pure-crypto primitives). TEEs are what works today. When MPC matures enough for interactive coordination, the coordinator can be swapped out.

## How clients verify the enclave

Before submitting anything to the coordinator, each party needs assurance that the code running inside the enclave is exactly the open-source coordinator, unmodified and unobserved by the operator. This is the job of remote attestation.

![Remote attestation flow](/assets/images/2026-03-12-private-crosschain-swap-part-2/diagram-1-attestation-flow.png)

The build process is deterministic. The coordinator binary, its configuration, and its dependencies are packaged into an image. A build tool hashes everything in that image into a set of measurements (fingerprints of the code, configuration, and boot chain). These measurements are public: anyone can rebuild the image from source and verify they get the same hash.

When the enclave boots, it generates a fresh encryption key pair and asks the hardware security module on the host card to sign a certificate binding that key to the enclave's measurements. The hardware module's signature chains to the cloud provider's root certificate, which is publicly verifiable.

When a client connects, the TLS handshake presents this certificate. The client checks three things: the signature chain is valid (the certificate was issued by the hardware module, which chains to the provider's root), the measurements match the expected enclave image (the code is what it claims to be), and the encryption key in the certificate is the one the enclave actually holds (the session is not being intercepted). If all three checks pass, the encrypted channel terminates inside the attested code. The operator cannot read the traffic.

## Inside the coordinator

The coordinator's job is narrow: receive submissions from both parties, verify that their locked notes match the agreed swap terms, and publish the claim secrets atomically.

![TEE coordinator architecture](/assets/images/2026-03-12-private-crosschain-swap-part-2/diagram-2-tee-coordinator.png)

### What the coordinator receives

Each party submits a swap identifier, a nonce, their ephemeral public key, an encrypted salt, and the plaintext details of the note they locked. The coordinator never receives any spending key. It gets public keys and note metadata, nothing that could be used to move funds.

### Hash-only verification

The core design choice: the TEE performs no cryptographic operations beyond hashing. All the expensive math (stealth address derivation, shared secret computation, salt encryption) was already proven correct inside the ZK circuit and verified on-chain when each party locked their note.

The ZK circuit outputs four binding commitments as public inputs alongside the note commitment:

```
h_swap = Hash("tee_swap_v0", swap_id, salt)
h_R    = Hash(eph_pk)
h_meta = Hash(meta_pk_counterparty, salt)
h_enc  = Hash("enc", encrypted_salt)
```

These commitments are recorded on-chain when the lock transaction is verified. They are sealed envelopes: the ZK proof guarantees the values inside are consistent with the stealth address derivation, but the values themselves are not revealed on-chain.

The coordinator opens these envelopes. For each party, it recomputes the hashes from the submitted plaintext and checks that they match what was recorded on-chain. Eight hash comparisons per swap, plus commitment and swap ID recomputation. If any check fails, the coordinator rejects the swap.

ZK proves the math is correct. The TEE proves both parties revealed consistent secrets. The blockchain proves finality. If the TEE is compromised, an attacker learns the swap details (amounts, counterparties), which is a privacy breach. But they cannot steal funds, because they never had access to spending keys. Financial correctness comes from the ZK proofs, not from the TEE.

### Atomic revelation

Once both submissions are verified, the coordinator posts a single transaction to the announcement contract containing both ephemeral public keys and both encrypted salts. The contract enforces that each swap ID can only be announced once, preventing replays. An observer sees a swap ID, two random-looking values, and two encrypted values. They learn that a swap was announced, but not the amounts, asset types, chains, or participant identities.

After the announcement, both parties read the on-chain data, derive their stealth spending keys, decrypt the salt, reconstruct the counterparty's note, and submit a claim proof. If the announcement never happens, the timeout expires and both parties reclaim their own funds through the fallback path.

## Running the demo

We ran the full protocol on Sepolia (L1) and Scroll Sepolia (L2) with pre-deployed contracts on both networks. Alice holds USD notes on Sepolia, Bob holds bond notes on Scroll, and they want to swap atomically and privately.

The demo walks through four phases. First, Alice and Bob each receive a funded note on their respective chain (standard shielded UTXO commitments with no link to the recipient's identity). Second, both parties agree on swap terms off-chain, derive a deterministic swap ID, and lock their notes to stealth addresses. At this point, each party generates a ZK proof (around 9 KB) that the lock is correctly formed. Third, both parties submit their secrets to the coordinator over the attested encrypted channel. The coordinator verifies the binding commitments against on-chain data and, once both sides check out, posts the announcement transaction. Fourth, both parties read the announcement, derive their claim keys, and submit claim proofs. Alice ends up with bond notes on Scroll; Bob ends up with USD notes on Sepolia.

The full demo output (with links to every on-chain transaction on Sepolia and Scroll explorers) is available as a [gist](https://gist.github.com/Meyanis95/93c01b2d486489633655949997384483).

## Limitations

### Hardware trust

The hardware trust assumption has no cryptographic fallback. If the hardware vendor is compromised, or has been compelled, they can read everything inside the enclave. Side-channel attacks have a long history (Foreshadow, Plundervolt, SGAxe); hypervisor-isolated enclaves have a simpler boundary, but the class of vulnerability is not eliminated. A single TEE instance is also a single point of failure for liveness: if the enclave goes down, swaps stall until the timeout expires.

### Protocol gaps

The shielded pool contracts must be deployed on every network where assets are traded. Each deployment starts with an empty Merkle tree and zero anonymity set. Growing that set takes time and volume.

Rollup finality is limited. Confirmation times affect the lock and claim windows, and a locked note must survive potential reorgs on both chains before it is safe to coordinate.

The UTXO model requires custom wallet infrastructure: scanning for notes, decrypting memos, tracking nullifiers, managing Merkle proofs. None of this has standardized tooling today. The account model has decades of wallet support and established tooling. The UTXO model trades that for privacy, and the tooling cost is real.

During the lock window, time-locked notes are distinguishable from standard notes (they carry a non-zero timeout). This leaks the existence of a pending swap, though not the amounts, assets, or identities.

### PoC-specific

The coordinator trusts its RPC endpoint. A compromised RPC could feed false on-chain state. Running a light client like [Helios](https://github.com/a16z/helios) inside the enclave would fix this by verifying state proofs against the consensus layer directly.

The hash verification could itself be expressed as a SNARK. The coordinator would post a ZK proof of correct verification on-chain instead of raw data, cheaper to verify and independently auditable. The verification logic (Poseidon hashes, no curve arithmetic) is simple enough that the circuit would be straightforward.

The announcement contract uses a simple externally owned account for the TEE signer. In production, a smart account ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) would support key rotation and censorship resistance: if the TEE's key is compromised or the operator is censoring, the account's governance logic can rotate to a new enclave.

## Institutional fit

### Settlement agent, not custodian

A TEE coordinator plays a role similar to a settlement agent. It sits between two counterparties, verifies that both sides have met their obligations, and finalizes the instructions. But unlike a traditional settlement agent, it never holds funds (they stay in on-chain contracts controlled by ZK proofs). Its code is verifiable through remote attestation. And if it goes down, the timeout refund kicks in — the worst case is a delay, not a default.

This maps to institutional DvP workflows: tokenized securities on one chain, stablecoins on another, with the coordinator replacing the custodian or depository in the middle.

### Censorship resistance

The shielded pool contracts are permissionless. Any institution can run their own TEE coordinator: deploy their own announcement contract, run their own attested enclave, operate independently. If the protocol's default coordinator censors a party, that party can stand up their own infrastructure and complete the swap without anyone's permission.

### Compliance

The coordinator sees trade metadata in memory during execution, but the enclave has no persistent storage. When it shuts down, the data is gone. The viewing key architecture from the [shielded pool design](/building-private-transfers-on-ethereum/) still applies: institutions can grant viewing keys to regulators for selective disclosure of their transaction history.

The TEE operator is a service provider with contractual obligations, not a custodian. The worst they can do is refuse to act, which triggers the timeout refund.

For bilateral trades between institutions already operating on-chain, this setup removes the custodian from the settlement chain. The trade-off is a hardware trust assumption: you are trusting a chip vendor instead of a custodian bank. For institutions not yet on-chain, the TEE is a new trust surface to evaluate against their existing clearing and settlement infrastructure.

## Potential alternative coordinator primitives

The TEE coordinator is a starting point. Other primitives make different trade-offs between trust and performance.

**MPC (Multi-Party Computation).** Replace the single TEE with a threshold protocol: n-of-m independent parties must collude to break privacy. No hardware trust assumption, but higher latency and more complex operational setup.

**Co-SNARKs (Collaborative ZK Proving).** Each party contributes private inputs to a joint ZK proof without revealing them to anyone. The coordinator becomes a protocol rather than a trusted party. Research-stage, not yet practical for interactive coordination.

**FHE (Fully Homomorphic Encryption).** The coordinator verifies encrypted submissions without ever decrypting. Impractical today (orders of magnitude slower than plaintext hashes) but worth watching as performance improves.

TEEs are the fastest and simplest option but carry hardware trust. MPC removes the hardware dependency at the cost of latency and operational complexity. ZK and FHE would eliminate trust entirely but are not yet fast enough for interactive settlement.

The full implementation is open source, with a detailed [specification](https://github.com/ethereum/iptf-pocs/tree/main/pocs/approach-private-trade-settlement/tee_swap/SPEC.md) and an [interactive protocol walkthrough](/tee-protocol-page).

## References

<span id="ref-1">**[1]**</span> V. Costan and S. Devadas, "Intel SGX Explained," Cryptology ePrint Archive 2016/086. [[PDF](https://eprint.iacr.org/2016/086.pdf)]
<span id="ref-2">**[2]**</span> AWS, "AWS Nitro Enclaves." [[Docs](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html)]
<span id="ref-3">**[3]**</span> S. Knauth et al., "Integrating Remote Attestation with Transport Layer Security," Intel, 2018. [[arXiv](https://arxiv.org/abs/1801.05863)]
<span id="ref-4">**[4]**</span> J. Van Bulck et al., "Foreshadow: Extracting the Keys to the Intel SGX Kingdom," USENIX Security 2018. [[PDF](https://foreshadowattack.eu/foreshadow.pdf)]
<span id="ref-5">**[5]**</span> Confidential Computing Consortium (Linux Foundation). [[Site](https://confidentialcomputing.io/)]
