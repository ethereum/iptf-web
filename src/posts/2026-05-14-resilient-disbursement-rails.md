---
layout: post
title: "Resilient Disbursement Rails"
description: "Aid payments on Ethereum that protect recipients even when local partners are compromised, or when recipients cash out into local currency."
date: 2026-05-14 15:00:00 +0200
author: "Aaryamann"
image: /assets/images/2026-05-14-resilient-disbursement-rails/hero.png
tags:
  - disbursement
  - shielded-pool
  - stealth-addresses
  - smartcard
  - humanitarian-aid
  - zero-knowledge
  - proof-of-concept
---

*This is the second post in our three-part resilience series, after [Resilient Plural Identity](/resilient-plural-identity/). The identity post asked how a person can keep proving who they are when the authority that vouched for them disappears or turns hostile. This one asks how money can reach that person when the local partner handing out the funds can be forced to share its records, and when the exchange where they cash out into local currency records their identity.*

Humanitarian payments create lists. Wherever the rail runs, some party keeps a record. That record is one subpoena or one regime change away from being evidence against a specific recipient. The best beneficiary database is the one you never create.

A funder funds a pool, the recipient's smartcard produces a one-time claim, a relay does the heavy proving, and Ethereum settles the payment to a fresh address. Under the non-collusion assumptions, no single component learns the full person → claim → cash-out mapping.

The protocol hides the path from funder to off-ramp deposit. At the off-ramp, the recipient hands a passport to the exchange that converts funds to local cash and keeps that record. Joining that record back to who received aid would require a beneficiary list, and the rail does not produce one.

We have run into versions of this in our own work. The [shielded pool](/building-private-transfers-on-ethereum/) and [plasma chain](/private-stablecoins-with-plasma/) we built both treat the depositor and the recipient as the privacy boundary. They make on-chain trace useless to a passive observer. They do not protect a recipient who has to walk to a licensed exchange, hand over a passport, and sell the asset for local currency. Every documented financial-surveillance prosecution pivoted on the KYC'd exchange account, the merchant identifier visible to a domestic bank, or the subpoenaed exchange record. Chain analytics on its own has not deanonymized a specific recipient in any case in the public record.

The constraint set is sharper when recipients live somewhere the authorities are hostile to the funder, the implementing partner, or the recipients themselves. Recipients cannot be assumed to have a phone or an internet connection. Implementing partners may get breached, coerced, or inherited by successor regimes. The protocol assumes every party in the path between funder and recipient will eventually be compromised.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-payment/resilient-disbursement-rails), with a detailed [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/private-payment/resilient-disbursement-rails/SPEC.md).

## How aid disbursement breaks today

The standard model for cross-border humanitarian disbursement is a layered chain of trust. A donor signs a grant agreement with an implementing partner. The implementing partner enrolls beneficiaries through field agents, captures biometric or document-based identity records, and pushes funds through commercial rails: bank transfer, mobile money, money transfer operators, prepaid cards, or hawala intermediaries. Each layer holds enough state to identify any recipient on demand.

The state that lets the chain function under good conditions is exactly what makes it brittle under bad ones. Three failure modes recur in the public record.

**Implementing-partner databases get inherited.** Beneficiary registries have either been seized or shared with adversarial governments without consent. Compelled disclosure has driven most of the documented humanitarian-data prosecutions.

**Off-ramps pivot KYC.** Certain investigations combined on-chain trace with subpoenaed exchange records to identify specific individuals. Chain analytics on its own was insufficient. The KYC process in the exchange was the crucial input.

**Rails get frozen and civil identity gets weaponized.** Account freezes used as political instruments against named protest organisers, and rail de-risking show that traditional rails fail under sustained political pressure. State civil-identity systems collapse when the state is the adversary.

The recipient constraint set is the hardest part. Recipients hold tamper-resistant smartcards, cannot run zero-knowledge provers on-card, may have intermittent or no internet, and lose devices at meaningful rates.

## What we built

![The funder shields per-recipient amounts atomically; recipients claim through smartcard-signed vouchers relayed through mesh and anonymous transports; the off-ramp is the trust boundary](/assets/images/2026-05-14-resilient-disbursement-rails/what_we_built.png)

A round runs in four stages. The funder publishes the round and shields the full disbursement in one atomic transaction. Recipients sign an offline voucher on a smartcard, under a stealth key derived on-card. In the production path, a relay turns the voucher into two zero-knowledge proofs and submits through Tor, Nym, or HOPR; the PoC keeps those as explicit transport boundaries and uses direct in-process adapters. The claim contract verifies, unshields to a one-time stealth destination, and burns the nullifier. After the round closes plus a 30-day timelock, the funder multisig can sweep any residual via balance accounting; there is no zero-knowledge proof on the residual path.

Two things are out of scope. Cross-funder anonymity, because each claim contract has its own pool sub-tree. Forward secrecy under card seizure, because the master secret is long-lived.

## How a round publishes

![Round publication is atomic. The factory verifies cohort identity against the Registry, deposits one Poseidon commitment per active card into the claim contract's sub-tree, and registers the header](/assets/images/2026-05-14-resilient-disbursement-rails/how_a_round_publishes.png)

Round publication is the only on-chain event in which the funder appears, and it is one atomic transaction. The factory pulls the funder's tokens, deposits one commitment per active card into the claim contract's pool sub-tree, and registers the signed header. A revert at any step reverts the whole thing.

## How recipients claim

![The smartcard derives the per-claim stealth public key on-card via HMAC, constructs the 308-byte preimage internally, and signs with secp256k1 ECDSA.](/assets/images/2026-05-14-resilient-disbursement-rails/how_recipients_claim.png)

The recipient inserts the smartcard into a companion device. The companion verifies the funder's signature on the round header (the only point in the protocol where that signature is checked) and passes the voucher context to the card. The card derives a per-claim stealth keypair from the master secret via HMAC-SHA256, builds the voucher preimage internally, and signs it with secp256k1 ECDSA. The card must construct the preimage internally rather than accept a pre-hashed digest, otherwise a malicious companion could substitute a different derived public key and have the card sign over the lie.

The companion handles the rest: deriving the destination from the derived public key, computing the domain-tagged Poseidon nullifier, and encrypting the voucher under the relay's rotating X25519 + ChaCha20-Poly1305 key (rotated every 24 hours).

This split is what makes Registry compromise survivable. The nullifier folds the derived public key in as a private circuit witness, so an adversary who compels the Registry's master public key list still cannot enumerate candidate nullifiers without the on-card secret.

## How relays close the loop

![The relay decrypts the voucher, generates the claim and pool-withdraw proofs, and submits through Tor, Nym, or HOPR. The claim contract verifies both proofs, enforces cross-proof binding via the shared nullifier, and unshields to the stealth destination.](/assets/images/2026-05-14-resilient-disbursement-rails/how_relays_close_the_loop.png)

The companion hands the encrypted voucher to mesh transport (Briar over Bluetooth LE plus Tor, Meshtastic over LoRa, Reticulum over LoRa or packet radio, or any conforming adapter). A relay decrypts, generates the two zero-knowledge proofs, and submits the claim transaction through Tor, Nym, or HOPR. Relays sign with rotating EOAs to bound cross-round linkability.

The claim contract runs a checklist before unshielding: timing, both proof verifications, header bindings, cross-proof bindings via the shared nullifier, pool-root recency, and nullifier non-reuse. The submitter is bound into the proof to defeat proof-stealing front-running.

A recipient may fan out the same voucher to multiple relays; only the first on-chain settlement consumes the nullifier.

## Compliance for humanitarian operators

Humanitarian operators are not banks, but they work under a serious data-protection regime. The [ICRC Handbook on Data Protection in Humanitarian Action (3rd ed, 2024)](https://www.icrc.org/en/data-protection-humanitarian-action-handbook) is the sectoral reference. Its chapters on data minimization, third-party access requests, and shielding beneficiaries from re-identification each map onto a design choice here.

The important part is simple: there is no central beneficiary list at the on-chain layer. The funder's on-chain footprint is round-level aggregates (round identifier, `cohortRoot`, cohort size, per-recipient amount, claim transactions). The Registry holds `(cardId, M, status, cohort_position)` per card, which is the minimum needed to publish `cohortRoot`. The implementing partner holds field-distribution records, which are the minimum needed to deliver cards and headers. None of these surfaces, taken alone, suffices to identify a recipient at a specific claim event.

[GDPR Article 25](https://gdpr-info.eu/art-25-gdpr/) (data protection by design and by default) is the regulatory hook for European-funded operations. The per-claim-contract sub-tree partition and the private-witness `derivedPubkey` instantiate Article 25 directly: the on-chain layer is designed to minimize personal data, and the cryptographic boundary between Registry, partner, and on-chain claim is enforced by construction rather than by policy.

The [Sphere Handbook](https://spherestandards.org/) treats cash and voucher assistance as a delivery modality across its sectoral minimum standards, which demand accountability and transparency in disbursement. The on-chain `Claimed(roundId, nullifier, destination, amount, relaySubmitter)` events give an auditable record of disbursement aggregates: an auditor with the round header can reconstruct what was paid, when, and how much, without learning who. The [CALP Network](https://www.calpnetwork.org/) is the integration target for any production deployment that needs to interoperate with existing CVA programs.

The protocol was built humanitarian-first, but the same structure fits any disbursement where recipient-to-claim linkage is sensitive: per-employee bonus pools, per-counterparty rebates, or regulated transfers where naming the recipient's jurisdiction would compromise the sender.

The architecture can support compliance with these regimes, but it is not legal compliance by itself. Operators are responsible for their own legal review.

## Architecture

| Layer | Tools |
| --- | --- |
| Circuits | [Noir](https://noir-lang.org/), [UltraHonk](https://github.com/AztecProtocol/barretenberg) |
| Contracts | Solidity, [Foundry](https://getfoundry.sh/), [LeanIMT](https://github.com/zk-kit/zk-kit/tree/main/packages/lean-imt) |
| Client | Rust, [Alloy](https://github.com/alloy-rs/alloy) |
| Smartcard | JCOP-class, [BSI-CC-PP-0084](https://www.bsi.bund.de/SharedDocs/Zertifikate_CC/PP/aktuell/PP_0084.html) AVA_VAN.5 in production; software emulator in PoC |
| Hashing | [Poseidon](https://www.poseidon-hash.info/) (BN254), SHA-256, keccak256 |
| Signing | secp256k1 ECDSA per [SEC 1](https://www.secg.org/sec1-v2.pdf), [EIP-2](https://eips.ethereum.org/EIPS/eip-2) canonical-s |
| Anonymous transport | [Tor](https://www.torproject.org/), [Nym](https://nym.com/), [HOPR](https://hoprnet.org/) |
| Mesh | [Briar](https://briarproject.org/), [Meshtastic](https://meshtastic.org/), [Reticulum](https://reticulum.network/) |

Two circuits, four contract roles. The claim circuit verifies cohort membership, voucher signature, destination derivation, and nullifier construction. The pool-withdraw circuit verifies sub-tree membership and recomputes the nullifier from the same private witnesses, exposing recipient, token, amount, and pool root as public inputs. The four contract roles are the funder Multisig (the on-chain authority gate for both round publication and residual recovery), the Round Factory (the atomic publish-and-shield contract), the Claim Contract (the round registry plus claim verifier), and the IShieldedPool (the per-claim-contract partitioned shielded ERC-20 pool).

The smartcard exposes three custom APDUs (Application Protocol Data Unit, the smartcard command format). `GENERATE_KEY` performs one-time on-card master keypair generation via the on-card TRNG (true random number generator). `EXPORT_KEY` exports the master public key at enrollment only. `SIGN_VOUCHER` runs the per-claim signing flow described above. The PoC ships a Rust software emulator standing in for the JCOP applet; production deployments target EAL4+ AVA_VAN.5 hardware (Common Criteria's vulnerability-resistance grading; EAL4+ AVA_VAN.5 is the floor for production smartcards under BSI's Protection Profile). The implementation simplifies a few details documented in the README: small integer literals replace SHA-256-derived Poseidon domain tags, in-process direct adapters stand in for real mesh and Tor, Nym, or HOPR transports, and the residual-recovery path uses balance accounting rather than a batch-withdraw circuit.

## Threat model

| Adversary | What they see | What they cannot do |
| --- | --- | --- |
| Public observer | Round headers, claim transactions, public inputs (nullifier, destination, amount, claim-contract address, relay submitter), funder identity | Link a claim to a specific cohort member beyond membership in `cohortRoot`; precompute candidate nullifiers from `cohortRoot` alone |
| Compelled implementing partner | Field-distribution records (which agent handed which card to which person where) | Produce a claim from a recipient's slot without that recipient's smartcard; deanonymize past on-chain claim events (no cardId on chain) |
| Compelled or breached Registry operator | Per-card `(cardId, M, status, cohort_position)`, per-version `cohortRoot` and `cohortSize` | Compute candidate nullifiers (needs `derivedPubkey`, requires the on-card secret); forge a voucher (blocked by the on-card ECDSA over `M`) |
| Compromised relay (after voucher decryption) | `M`, `derivedPubkey`, `roundId`, `chainId`, `destination`, `amount`, `claimContract`, `nullifier`, signature, Merkle path, plus its own network origin | Front-run with a different submitter (the proof binds `relaySubmitter` to `msg.sender`); link an upcoming claim back to a specific recipient identity |
| Off-ramp KYC operator | The stealth destination plus whatever KYC the recipient surrenders at deposit | Walk back from destination to cohort beyond pool-level k-anonymity within `(token, amount)` deposits in the calling claim contract's sub-tree |

Honest-party assumptions: Registry operator and implementing partner are organizationally separated (distinct legal entities, jurisdictions, personnel, infrastructure); the smartcard's chip platform retains AVA_VAN.5-level tamper resistance; at least one honest reachable relay exists per claim attempt; recipients use diverse relays across rounds; Ethereum censorship resistance holds at settlement.

## Limitations

This is a proof-of-concept and the limitations are real. The four worth flagging at length are documented below. Each has a stated mitigation path; none is a fatal-by-design flaw.

**Tampered-card double-spend within a single `(M, roundId)`.** The card's on-card derivation of `derivedPubkey` is load-bearing for both destination correctness and nullifier integrity. A malicious card could sign over multiple distinct `derivedPubkey` values, producing distinct nullifiers from a single cohort slot. On-chain accounting deduplicates only on `nullifier`. The cumulative-damage ceiling is therefore the round's full `cohortSize * perRecipientAmount`, not a single recipient's slot. Once the per-round consumed-nullifier counter exceeds `cohortSize`, `funderUnshieldResidual` underflows and residual recovery for that round is permanently DoS'd. Mitigated by the AVA_VAN.5 chip-platform honesty assumption. The production-path mitigation is in-circuit verification of `derivedPubkey = HMAC(m, ctx) * G`, which is incompatible with the current invariant that the master secret never leaves the card. The honest path forward is a forward-chain extension as a separate spec addendum.

**First-spend `derivedPubkey` disclosure.** When the recipient first signs an Ethereum transaction from `destination`, ECDSA public-key recovery exposes `derivedPubkey` on chain. An adversary holding the cohort `M` list can then compute `derivedPubkey_packed` for the recovered key, recompute the nullifier preimage, and confirm that "claim event e originated from card X." This is a one-time linkability event per card per round and is intrinsic to spending from EOA destinations. Recipients who require unlinkable spend MUST forward funds through a privacy-preserving wrapper before doing so.

**Funder-Registry collusion via the `commitment_i` to `M_i` table.** The funder pre-computes `commitments[i]` in cohort-position order and submits them via `publishRound`. Combined with the Registry's `M_i` to `cardId` mapping, the union learns `cardId` to `commitment_i`. The pool's `Unshielded` event hides `leafIndex`, so chain-only deanonymization does not follow directly. A Registry-funder-off-ramp coalition collapses cohort anonymity. Funders MUST treat the cohort-order commitment table as sensitive: delete it post-publication, or hold it under organizational separation from Registry operations.

**Forward secrecy under card seizure.** The long-lived per-card master secret exposes the destination of past claims if the card is seized. The PoC mitigation is operational revocation on suspected seizure. Production deployments needing forward secrecy MUST adopt a forward-chain extension (a forward-secure SHA-256 hash chain on-card), with the well-known requirements: non-wear-leveled persistent memory, vendor letter, bounded card lifetime, enrollment-time pubkey-list precommitment ceremony, and Faraday-shielded perso-bureau. These are out of scope for the PoC.

A handful of smaller limitations are answered at the operational layer rather than the cryptographic one. Cross-round per-relay linkability is bounded by recipient-side relay diversity per round. Claim-time correlation is bounded by relay submission delay over at least one hour and Poisson cover traffic. Submission-EOA funding trails are bounded by per-round or per-24-hour rotation. Tor end-to-end confirmation under a global passive adversary motivates migration to a mixnet (Nym or HOPR) once Ethereum wallet integration matures. The relay economic-recovery model is unresolved at the spec level; commission, L2 settlement, and funder reimbursement each carry different privacy consequences and the choice is a deployment decision rather than a protocol one.

## Related work

This builds on a few existing lines of work.

[Railgun](https://railgun.org/) with Private Proofs of Innocence is a production shielded-pool deployment on Ethereum mainnet. This protocol's `IShieldedPool` interface is satisfiable by any Railgun-class deployment.

[Privacy Pools](https://privacypools.com/) formalized the association-set model that bounds this PoC's pool-level k-anonymity argument. The reachable anonymity set at the off-ramp is the calling claim contract's sub-tree, which is exactly the association-set framing.

[Hinkal](https://hinkal.pro/) ships a programmable shielded-pool stack focused on access control and selective disclosure. It is complementary to the per-claim-contract sub-tree partition this protocol uses to bound the relay-side proving surface.

The stealth-address standards [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) (address generation) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) (stealth meta-address registry), with deployments at [Umbra](https://app.umbra.cash/) and [Fluidkey](https://fluidkey.com/), establish the recipient-derived-destination pattern. This protocol's stealth derivation runs on-card via HMAC over the master secret, not off-card from a published meta-address. The decision keeps the secret on the smartcard and trades a published-meta-address ergonomic for a tamper-resistance gain.

[Keycard](https://keycard.tech/) is the open-source secure-element wallet reference for this prototype, running on EAL6+ chips. The `SIGN_VOUCHER` applet here targets a comparable JCOP-class envelope, with EAL4+ AVA_VAN.5 ([BSI-CC-PP-0084](https://www.bsi.bund.de/SharedDocs/Zertifikate_CC/PP/aktuell/PP_0084.html)) as the production-target floor. The [GridPlus Lattice1](https://gridplus.io/) is a comparable secure-element plus companion architecture.

[Briar](https://briarproject.org/) (Bluetooth LE plus Tor), [Meshtastic](https://meshtastic.org/) (LoRa), and [Reticulum](https://reticulum.network/) (LoRa, packet radio, and other transports) are the candidate `ISubmission` transports for offline voucher delivery from companion to relay. The PoC's port abstraction makes any conforming mesh transport interoperable.

[Tor](https://www.torproject.org/), [Nym](https://nym.com/), and [HOPR](https://hoprnet.org/) are all good `IAnonymousTransport` candidates for relay-to-claim-contract submission.

[Semaphore](https://semaphore.pse.dev/) and [PLUME](https://aayushg.com/thesis.pdf) ([ERC-7524](https://eips.ethereum.org/EIPS/eip-7524)) are the established membership-proof and nullifier primitives this protocol's claim circuit extends. In-circuit secp256k1 ECDSA verification is established prior art ([PLUME](https://eprint.iacr.org/2022/1255), [Spartan-ECDSA](https://github.com/personaelabs/spartan-ecdsa), [stealthdrop](https://github.com/noir-lang/stealthdrop)). What is specific to this protocol is the smartcard composition: the master keypair is generated and held on a JCOP-class chip and never leaves it, the recipient signs ECDSA only, and the cohort tree commits to secp256k1 master public keys rather than Poseidon-only identities.

[Zerocash](https://eprint.iacr.org/2014/349) (Ben-Sasson et al., 2014) is the prior-art reference for commitment-nullifier shielded payments. This protocol's pool-withdraw circuit is a direct descendant of the Zerocash spend circuit, restricted to a per-claim-contract sub-tree and bound to a claim circuit via a shared nullifier.

There also exist multiple large-scale humanitarian cash-and-voucher programs that inspired part of this design.

## What comes next

Three threads we want to pull on. Forward-secure signature chains on-card, to retire the long-lived master secret and bound past-claim disclosure under card seizure. Cross-funder anonymity, by lifting the per-claim-contract sub-tree partition into a shared association set with a compatible compliance witness. Batch-withdraw circuits, to amortize verification gas across multiple claims per transaction.

The [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/private-payment/resilient-disbursement-rails/SPEC.md) has the full circuit constraints, data structures, and security considerations. The IPTF Map [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/resilient-disbursement-rails.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-private-payments.md) documents place this in the broader institutional-privacy work. Pull requests are welcome.
