---
layout: post
title: "Resilient Disbursement Rails"
description: "Aid disbursement on Ethereum that survives partner compromise and off-ramp deanonymization."
date: 2026-05-06 10:00:00 +0100
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

*This is the second post in our three-part resilience series, after [Resilient Plural Identity](/resilient-plural-identity/). Where the identity post asked who can prove they belong, this one asks how funds reach them when every off-ramp is a deanonymizer and every implementing partner is one subpoena away from being the adversary's database.*

Disbursement is the act of getting money from an institution to a recipient. For a foundation paying grantees, a multinational paying contractors, or an aid donor reaching beneficiaries in a hostile jurisdiction, the same question keeps coming back: who can see who got paid, and what happens when that information becomes a target?

We have run into versions of this in our own work. The [shielded pool](/building-private-transfers-on-ethereum/) and [plasma chain](/private-stablecoins-with-plasma/) we built both treat the depositor and the recipient as the privacy boundary. They make on-chain trace useless to a passive observer. They do not protect a recipient who has to walk to a licensed exchange, hand over a passport, and sell the asset for local currency. The off-ramp is where every documented financial-surveillance prosecution pivoted. Chain analytics on its own has not deanonymized a specific recipient in any case in the public record. The KYC'd exchange account, the merchant identifier visible to a domestic bank, and the subpoenaed exchange record have.

The constraint set is sharper still when the recipients live somewhere the authorities are hostile to the funder, the implementing partner, or the recipients themselves. Recipients in Yemen, Afghanistan, Syria, the Rohingya camps, or Russia under the FBK donor crackdown cannot be assumed to have a phone, an internet connection, or even a fixed home. Implementing partners (NGOs, money transfer operators, local agents) get breached, get compelled, and get inherited by successor regimes. The protocol on top has to assume every party in the path between funder and recipient will eventually be compromised.

We built a proof-of-concept that disburses a fixed per-recipient amount to a cohort of smartcard holders without exposing recipients to off-ramp deanonymization, partner-database compromise, or successor-regime database inheritance. The funder shields the full disbursement atomically into a shielded pool. Recipients sign offline vouchers on tamper-resistant smartcards. Relays generate the zero-knowledge proofs that recipients cannot generate on-card, and submit through Tor, Nym, or HOPR. Every off-ramp deposit lands at a one-time stealth destination derived on-card from the recipient's master secret.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-payment/resilient-disbursement-rails), with a detailed [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/private-payment/resilient-disbursement-rails/SPEC.md).

## How aid disbursement breaks today

The standard model for cross-border humanitarian disbursement is a layered chain of trust. A donor signs a grant agreement with an implementing partner. The implementing partner enrolls beneficiaries through field agents, captures biometric or document-based identity records, and pushes funds through commercial rails: bank transfer, mobile money, money transfer operators, prepaid cards, or hawala intermediaries. Each layer holds enough state to identify any recipient on demand.

The state that lets the chain function under good conditions is exactly what makes it brittle under bad ones. Three failure modes recur in the public record.

**Implementing-partner databases get inherited.** Beneficiary registries from the Rohingya enrollment program, Yemen's WFP SCOPE deployment, the 2021 Afghanistan transition, the December 2024 Syria transition, occupied territories in Ukraine after 2022, and Mosul under ISIS occupation between 2014 and 2017 have either been seized, shared with adversarial governments without consent, or been at acute risk of seizure. The compelled-disclosure surface is not hypothetical. It is the vector that has driven most of the documented humanitarian-data prosecutions.

**Off-ramps pivot KYC.** Russia's FBK donor prosecutions (more than 200 cases as of April 2026), the Nobitex 2025 KYC dump, the Israeli NBCTF seizure of 189 Binance accounts, and the 260+ Chinese crypto enforcement cases (2021 MPS sweep) all combined on-chain trace with subpoenaed exchange records to identify specific individuals. Chain analytics on its own was insufficient. The exchange's KYC was the load-bearing input.

**Rails get frozen and civil identity gets weaponized.** Account freezes used as political instruments (Nigeria EndSARS 2020 against named protest organisers, Belarus 2021 to 2022, Turkey Bank Asya 2016) and rail de-risking (Somali MTO 2013 to 2015, Afghanistan Western Union and MoneyGram 2021, Muslim charity de-banking 2014 to 2022) show that traditional rails fail under sustained political pressure. State civil-identity systems (Xinjiang IJOP, Turkey ByLock, India Aadhaar in Jharkhand, Pakistan NADRA) collapse when the state is the adversary.

The recipient constraint set is the hardest part. Recipients hold tamper-resistant smartcards, cannot run zero-knowledge provers on-card, may have intermittent or no internet, and lose devices at meaningful rates. Anything that requires a recipient to evaluate Poseidon hashes or BN254 elliptic-curve arithmetic on a JCOP-class smartcard is out.

## What we built

![The funder shields per-recipient amounts atomically; recipients claim through smartcard-signed vouchers relayed through mesh and anonymous transports; the off-ramp is the trust boundary](/assets/images/2026-05-14-resilient-disbursement-rails/what_we_built.png)

A round runs in four stages. The funder publishes the round and shields the full disbursement in one atomic transaction. Recipients sign an offline voucher on a smartcard, under a stealth key derived on-card. A relay turns the voucher into two zero-knowledge proofs and submits through Tor, Nym, or HOPR. The claim contract verifies, unshields to a one-time stealth destination, and burns the nullifier. After the round closes plus a 30-day timelock, the funder multisig can sweep any residual via balance accounting; there is no zero-knowledge proof on the residual path.

Three things are explicitly out of scope. Cross-funder anonymity, because each claim contract has its own pool sub-tree. Forward secrecy under card seizure, because the master secret is long-lived. Privacy of the off-ramp transaction itself; the off-ramp is the boundary the protocol delivers to, not past.

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

Humanitarian operators are not regulated entities in the bank-supervisory sense, but they operate under a substantial data-protection regime. The [ICRC Handbook on Data Protection in Humanitarian Action (3rd ed, 2024)](https://www.icrc.org/en/data-protection-humanitarian-action-handbook) is the authoritative sectoral reference. Its chapters on data minimization, on third-party access requests, and on the obligation to shield beneficiaries from re-identification under data transfer all map onto architectural choices in this protocol.

The mapping that does most of the work: there is no central beneficiary list at the on-chain layer. The funder's on-chain footprint is round-level aggregates (round identifier, `cohortRoot`, cohort size, per-recipient amount, claim transactions). The Registry holds `(cardId, M, status, cohort_position)` per card, which is the minimum needed to publish `cohortRoot`. The implementing partner holds field-distribution records, which are the minimum needed to deliver cards and headers. None of these surfaces, taken alone, suffices to identify a recipient at a specific claim event.

[GDPR Article 25](https://gdpr-info.eu/art-25-gdpr/) (data protection by design and by default) is the regulatory hook for European-funded operations. The per-claim-contract sub-tree partition and the private-witness `derivedPubkey` instantiate Article 25 directly: the on-chain layer is designed to minimize personal data, and the cryptographic boundary between Registry, partner, and on-chain claim is enforced by construction rather than by policy.

The [Sphere Handbook](https://spherestandards.org/) integrates cash and voucher assistance as a delivery modality across its sectoral minimum standards, which demand accountability and transparency in disbursement programs. The on-chain `Claimed(roundId, nullifier, destination, amount, relaySubmitter)` events provide an auditable record of disbursement aggregates. An auditor with the round header can reconstruct what was paid, when, and how much, without learning who. The [CALP Network](https://www.calpnetwork.org/) is the global network and learning partnership for cash and voucher assistance, and the integration target for any production deployment that wants to interoperate with existing CVA programs.

The protocol was designed humanitarian-first, but the same structure serves any disbursement where recipient-to-claim linkage is sensitive: per-employee bonus pools subject to internal-confidentiality requirements, per-counterparty rebates under restricted-information regimes, regulated transfers where the recipient-side jurisdiction would compromise the sender if disclosed.

The architecture is designed to support compliance with these regimes; it does not by itself constitute legal compliance. Operators are responsible for their own legal review.

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

The smartcard exposes three custom APDUs: `GENERATE_KEY` (one-time, on-card master keypair generation via the on-card TRNG), `EXPORT_KEY` (export of the master public key at enrollment only), and `SIGN_VOUCHER` (the per-claim signing flow described above). The PoC ships a Rust software emulator standing in for the JCOP applet; production deployments target EAL4+ AVA_VAN.5 hardware. The implementation simplifies a few details documented in the README: small integer literals replace SHA-256-derived Poseidon domain tags, in-process direct adapters stand in for real mesh and Tor, Nym, or HOPR transports, and the residual-recovery path uses balance accounting rather than a batch-withdraw circuit.

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

Several projects intersect this design from different angles. Here is where this protocol sits.

[Railgun](https://railgun.org/) with Private Proofs of Innocence is a production shielded-pool deployment on Ethereum mainnet, with the most developed answer to the off-ramp compliance question available today. This protocol's `IShieldedPool` interface is satisfiable by any Railgun-class deployment.

[Privacy Pools](https://privacypools.com/) formalized the association-set model that bounds this PoC's pool-level k-anonymity argument. The reachable anonymity set at the off-ramp is the calling claim contract's sub-tree, which is exactly the association-set framing.

[Hinkal](https://hinkal.pro/) ships a programmable shielded-pool stack focused on access control and selective disclosure. It is complementary to the per-claim-contract sub-tree partition this protocol uses to bound the relay-side proving surface.

The stealth-address standards [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) (address generation) and [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) (stealth meta-address registry), with deployments at [Umbra](https://umbra.cash/) and [Fluidkey](https://fluidkey.com/), establish the recipient-derived-destination pattern. This protocol's stealth derivation runs on-card via HMAC over the master secret, not off-card from a published meta-address. The decision keeps the secret on the smartcard and trades a published-meta-address ergonomic for a tamper-resistance gain.

[Keycard](https://keycard.tech/) is the open-source secure-element wallet reference, running on EAL6+ chips. The `SIGN_VOUCHER` applet here targets a comparable JCOP-class envelope, with EAL4+ AVA_VAN.5 ([BSI-CC-PP-0084](https://www.bsi.bund.de/SharedDocs/Zertifikate_CC/PP/aktuell/PP_0084.html)) as the production-target floor. The [GridPlus Lattice1](https://gridplus.io/) is a comparable secure-element plus companion architecture, with the difference that the companion in this PoC never sees the master secret and only computes the off-card destination and nullifier.

[Briar](https://briarproject.org/) (Bluetooth LE plus Tor), [Meshtastic](https://meshtastic.org/) (LoRa), and [Reticulum](https://reticulum.network/) (LoRa, packet radio, and other transports) are the candidate `ISubmission` transports for offline voucher delivery from companion to relay. The PoC's port abstraction makes any conforming mesh transport interoperable.

[Tor](https://www.torproject.org/), [Nym](https://nym.com/), and [HOPR](https://hoprnet.org/) are all good `IAnonymousTransport` candidates for relay-to-claim-contract submission.

[Semaphore](https://semaphore.pse.dev/) and [PLUME](https://aayushg.com/thesis.pdf) ([ERC-7524](https://eips.ethereum.org/EIPS/eip-7524)) are the established membership-proof and nullifier primitives this protocol's claim circuit extends. In-circuit secp256k1 ECDSA verification is established prior art ([PLUME](https://eprint.iacr.org/2022/1255), [Spartan-ECDSA](https://github.com/personaelabs/spartan-ecdsa), [stealthdrop](https://github.com/noir-lang/stealthdrop)). What is specific to this protocol is the smartcard composition: the master keypair is generated and held on a JCOP-class chip and never leaves it, the recipient signs ECDSA only, and the cohort tree commits to secp256k1 master public keys rather than Poseidon-only identities.

[Zerocash](https://eprint.iacr.org/2014/349) (Ben-Sasson et al., 2014) is the prior-art reference for commitment-nullifier shielded payments. This protocol's pool-withdraw circuit is a direct descendant of the Zerocash spend circuit, restricted to a per-claim-contract sub-tree and bound to a claim circuit via a shared nullifier.

[WFP SCOPE Cards](https://usermanual.scope.wfp.org/scope-cards/content/common_topics/introduction/1_introduction.htm), [WFP Building Blocks](https://innovation.wfp.org/project/building-blocks), and [GiveDirectly](https://www.givedirectly.org/) are the reference points for cash-and-voucher assistance at scale. SCOPE Cards is WFP's smartcard-based beneficiary identification and disbursement platform, backed by a centralized cloud registry; Building Blocks runs on a permissioned EVM-style chain and centralizes beneficiary records; GiveDirectly is the standard comparator for direct cash transfer. All three share the disbursement use case but none targets off-ramp unlinkability or smartcard envelopes for adversarial-jurisdiction recipients.

## What comes next

There are three threads we want to pull on. Forward-secure signature chains on-card to retire the long-lived master secret and bound past-claim disclosure under card seizure. Cross-funder anonymity, by lifting the per-claim-contract sub-tree partition into a shared association set with a compatible compliance witness, and batch withdraw circuits to amortize verification gas across multiple claims per transaction.

The [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/private-payment/resilient-disbursement-rails/SPEC.md) covers every circuit constraint, every data structure, and every security consideration. The IPTF Map [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/resilient-disbursement-rails.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-private-payments.md) documents show how this fits into the broader institutional privacy work. Pull requests are welcome.
