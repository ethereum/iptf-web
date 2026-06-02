---
layout: post
title: "Resilient Civic Participation"
description: "Petitions on Ethereum where the signer list never exists and the outcome stays verifiable from chain state alone."
date: 2026-05-29 15:00:00 +0200
author: "Aaryamann"
image: /assets/images/2026-05-28-resilient-civic-participation/hero.png
tags:
  - civic-participation
  - petition
  - direct-democracy
  - forward-secure-ratchet
  - eip-4844
  - zero-knowledge
  - proof-of-concept
---

*This is the third and final post in the resilience series, after [Resilient Plural Identity](/resilient-plural-identity/) and [Resilient Disbursement Rails](/resilient-disbursement-rails/). The identity post asked how a person can keep proving who they are when the authority that vouched for them disappears. The disbursement post asked how money can reach that person when the rail handing it out can be subpoenaed. This post asks the third question in the same shape: how can a person co-sign a public decision (a petition, an initiative, a citizen-led inquiry) without ending up on a list that a future regime can use against them.*

Petitions create signed lists. Whoever holds that list gets the leverage to make signing dangerous. The best petition system is the one that never produces a list at all; what survives the round is a count.

Take Venezuela in 2004. The petition to trigger a recall referendum against Hugo Chávez collected 2.4 million signatures. Months before the August 15 vote (which Chávez survived), National Assembly member Luis Tascón published the [signer list with national-ID numbers](https://globalfreedomofexpression.columbia.edu/cases/san-miguel-sosa-v-venezuela/) on his website. Public-sector workers on the list were [fired in retaliation](https://www.hrw.org/news/2016/07/20/venezuela-recall-supporters-fired); the list was already in active use months before the vote itself. In 2018 the Inter-American Court of Human Rights held Venezuela responsible for political-retaliation dismissals based on the list. The 2016 recall against Maduro reproduced the pattern. Variants of this pattern have played out across more than a decade in multiple jurisdictions.[^1]

The protocol described here removes the list. Signers prove eligibility against an external credential layer, sign at most once per petition, and submit through a relayer that aggregates many signatures into a single batched proof on Ethereum. The on-chain artifacts are per-class counts and a Boolean outcome, verifiable from L1 as long as the [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) blob payloads remain reachable through consensus retention or, past that window, a voluntary archive. A future government, a successor regime, or a coerced platform operator can demand the list, but the protocol does not produce one to hand over.

The implementation is [open source](https://github.com/ethereum/iptf-pocs/tree/master/pocs/civic-participation/resilient-civic-participation), with a detailed [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/civic-participation/resilient-civic-participation/SPEC.md). Sybil resistance is delegated to the [ResilientIdentity](/resilient-plural-identity/) credential layer from the first post in this series.

## How petition signing breaks today

The standard model is a three-party chain. A trusted organiser publishes the petition and collects signatures. A verifying authority (election commission, NGO compliance team, civic-tech vendor) checks each signature against a population register or a digital ID. The same state that lets this chain function in good conditions makes it brittle.

The European Citizens' Initiative, the EU's only direct-democracy instrument, requires signers in 18 of 27 member states to surrender their [national identifier or passport number](https://citizens-initiative.europa.eu/data-requirements_en), along with full name, address, date of birth, and nationality, to a state verifying authority. The ECI is well-regulated and GDPR-compliant; it is also a compelled-collection surface by design. Online petition platforms (Change.org, We the People, and most civic-tech notaries) keep the signer list on a centralised database tied to email accounts and are subject to data-retention orders, subpoenas, and payment-processor pressure.

Signers in adversarial jurisdictions face additional constraints: intermittent network access, no consistent device identity, and a meaningful probability of device seizure between sessions. The protocol assumes any party who can be reached by a subpoena will eventually be reached by one.

## What we built

![Organizer registers and funds a petition against the ResilientIdentity root R; signers build SNARKs that relayers aggregate into batches against the petition registry; disputants can repudiate active batches and a resolver closes the round.](/assets/images/2026-05-28-resilient-civic-participation/what_we_built.png)

A petition round runs in five stages. The organiser registers a petition under an existing ResilientIdentity (RI) Merkle root and escrows a bounty in an ERC-20 token. Eligible signers, each holding an RI credential, build a signer zero-knowledge proof against the registered petition and submit it through any reachable relayer. The relayer aggregates many signer proofs into a single batch proof that recursively verifies every inner proof, and publishes the batch as an EIP-4844 blob transaction. A two-week dispute window opens; anyone can repudiate a batch by submitting KZG openings that prove a specific record violates the batch rules. After the dispute window closes, anyone can compute the outcome from the blob payloads and the on-chain Indexed Merkle Tree roots, submit a resolution proof, and claim the bounty.

The petition's on-chain footprint is the running root, the count, the outcome bits, and pseudonymous per-signature records (nullifier, identity_tag, class_tag) in the carrying blobs. No identity-bearing list, or list mapping people to signatures, is created.

## Per-petition forward secrecy

Each signer holds a Forward-Secure Ratchet Tree (FSRT) chain. At enrolment the signer samples a seed, deterministically expands it into 2^24 per-slot values (each slot is a position in the signer's local ratchet, one per future petition) via a Poseidon-sponge length-doubling PRG ([Bellare and Yee, CT-RSA 2003](https://eprint.iacr.org/2001/035)), and commits to the depth-24 Merkle root inside their credential leaf. Once each petition's dispute window closes, the signer overwrites the seed material that produced that slot's value in place. A device compromise at time T reveals nothing about signatures whose petitions have already settled past their dispute deadlines.

In every documented case where a signer list became evidence, the evidence was static. The same name on the list yesterday is the same name on the list when the regime changes hands. Forward secrecy at the slot level converts a static asset into a perishable one. A device seized a year after the petition closed cannot reconstruct what was signed under the device's old slot keys, because the seeds were overwritten once each petition's dispute window closed. The signer keeps only the next seed, a log-space Merkle frontier ([Szydlo 2004](https://www.szydlo.com/szydlo-loglog.pdf) tail-node traversal), the chain root, and the attribute version; everything else is reconstructible on demand, and nothing reconstructible reveals past slots.

## How a petition publishes

![Registration is one atomic transaction: the registry validates the class-bound predicate, asserts the bounty floor, derives petition_id, advances the global slot counter, escrows the bounty, and emits PetitionRegistered.](/assets/images/2026-05-28-resilient-civic-participation/how_a_petition_publishes.png)

Registration is a single atomic transaction. The organiser supplies a predicate over signer attributes (for example, "is a citizen of one of these EU member states"), a class set (the per-jurisdiction buckets the threshold tally counts over), a per-class threshold (the minimum signatures required in each bucket), and a close-at-block deadline. The bounty must clear a calibration floor that scales with the threshold sum and the predicate's operation count, so a resolver always has economic incentive to produce the outcome proof.

The registry rejects predicates that are not *class-bound*, meaning predicates where a single signer's class tag could be omitted from every count. Without this check a malicious organiser could produce a petition whose tally is unfalsifiable. A global slot counter S advances by one per registration; with the FSRT chain at depth 24, the protocol admits up to 2^24 - 1 petitions over the lifetime of a signer's credential before re-enrolment is required.

## How signing works

![The signer advances the local FSRT to the petition's slot, derives the nullifier and identity tag, sends a signer SNARK to a relayer, and zeroises the slot's seed material once the petition's dispute window closes.](/assets/images/2026-05-28-resilient-civic-participation/how_signing_works.png)

A signer reads the petition's metadata from the registry and advances their local FSRT to the petition's slot. The advance is monotone, so once a signer passes slot k the local state cannot regress back to k without re-enrolment; that is what enforces "at most one signature per signer per petition" even under partial device compromise. The signer derives two values from the slot. A *nullifier* is a one-time tag that lets the chain reject a second signature without revealing who signed; it hashes the slot value, petition identifier, class index, class tag, and identity secret, and the registry deduplicates on it. An *identity tag* hashes the slot value and petition identifier, and the batch SNARK uses it to reject any two records in the same batch that share a signer.

The signer SNARK's public inputs commit to the petition identifier, class index, class tag, slot, nullifier, and identity tag. The private inputs include the identity secret, attribute vector, chain root, and Merkle paths binding everything back to the credential leaf and the petition slot. After L1 finality of the carrying batch, the signer advances the caterpillar frontier and writes the new ratchet state to disk atomically, but retains the slot's seed material in a journal until the petition's dispute window closes (fourteen days after close-at-block). Deferring zeroisation lets a signer who is cascaded out by a successful dispute on an earlier batch reproduce the signer SNARK and resubmit before the window closes; once it closes, the seed is overwritten in place. The atomic-journal step exists because a power loss between in-memory and on-disk state would otherwise admit a re-sign of the same slot with a different ratchet value. The relayer cannot forge a signature (the proof binds the public inputs and the registry checks against a deploy-pinned signer verification key) and cannot front-run by swapping the destination (the proof commits to the petition identifier and the slot).

## How batches publish

The relayer collects up to a configured maximum of signer submissions per petition, sorts them by the canonical leaf hash, and recursively verifies all inner proofs inside a single outer batch proof, which keeps on-chain verifier cost sub-linear in batch size. The batch proof commits to the prior and new Indexed Merkle Tree (IMT) roots, to the prior and new leaf counts, and to the field-element decomposition of the blob payload that the registry uses to verify on-chain that the batch and the blob agree byte-for-byte. The IMT shape gives cheap non-membership proofs, which the intra-batch-duplicate-identity-tag dispute path needs to verify cheaply on L1.

![The relayer recursively verifies N signer proofs into one batch SNARK and publishes the records as an EIP-4844 blob; the registry verifies the SNARK against its prior state and binds the batch to the blob via the 0x0a KZG precompile before advancing roots and leaf count.](/assets/images/2026-05-28-resilient-civic-participation/how_batches_publish.png)

One subtle piece is the cross-field binding. The batch SNARK operates over BN254 (the curve Ethereum's pairing precompiles support); EIP-4844 blob payloads live in BLS12-381. The batch SNARK exposes the per-record BLS12-381 field-element decomposition as public inputs, and the registry calls the KZG point-evaluation precompile at address `0x0a` for each one against the blob's versioned hash (a short on-chain commitment that identifies the blob). The two sides together close the binding without any of the SNARK doing BLS12-381 verification in-circuit. A relayer that publishes a blob disagreeing with what the batch SNARK committed to fails the on-chain KZG check before the batch enters state. A relayer that publishes a blob agreeing with the batch SNARK but containing a record that violates petition rules can still be repudiated during the dispute window.

## How disputes work

![A disputant repudiates a batch by submitting KZG openings that prove a record violates the batch rules; the registry verifies the openings against the batch's versioned hash and either rolls back the batch and every later active batch, or reverts ViolationFalse.](/assets/images/2026-05-28-resilient-civic-participation/how_disputes_work.png)

A disputant repudiates a batch by producing one of three enumerated violations against blob records: a class tag outside the petition's class set, two records in the same batch sharing an identity tag, or two adjacent records out of canonical leaf order. Each is also enforced by the batch SNARK; the dispute window is the defense-in-depth backstop against circuit bugs or proof-system unsoundness. A successful dispute repudiates the offending batch and every later active batch, because later batches' prior-state bindings are no longer canonical. In production, the cascade requires the relayer ecosystem to be diverse enough that a successor relayer can rebuild from the repudiation point. A single-relayer deployment has no liveness if the only relayer is the malicious one.

## How resolution closes the loop

Fourteen days after close-at-block, the dispute window ends and any party can compute the outcome. The resolver fetches the blob payloads of every active batch, reconstructs the leaf set, verifies that the leaf set's IMT root matches the registry's stored running root, counts the per-class records, and builds a resolution SNARK that commits the per-class counts and the threshold comparison. The on-chain check is one proof verification; the verifier learns whether each class threshold was met and the overall Boolean, and nothing about who signed.

A resolver who submits a wrong outcome fails the SNARK. A one-hour grace past the dispute deadline keeps `markUnresolved` from racing a valid resolution in the same block; once that hour passes with no resolution on chain, any party can call `markUnresolved`, which replaces the running root with a tombstone marker, refunds the bounty (less a 1% gas rebate cap) to the organiser, and transitions the petition to a permanent Unresolved state.

Blob retention is the operational caveat. EIP-4844 retains each batch's blob payload for 4096 epochs (around 18 days) from that batch's own publication block, not from the petition close. With signing windows up to 11.5 days and resolution opening 14 days after close-at-block, any batch published more than 4 days before close has already left consensus retention by the time resolution begins, and disputes against early batches lose consensus-retained data partway through the dispute window. Petitions therefore depend on a [voluntary archive](https://blobscan.com/) or long-term blob storage such as [EthStorage](https://ethstorage.io/) for batches outside that envelope; the on-chain batch SNARK commitments bind blob payloads to versioned hashes, so any archive copy is verifiable against the registry record. 

## Compliance for civic operators

The European Citizens' Initiative is the clearest regulatory mapping. Regulation (EU) 2019/788 specifies per-country signature minima ([degressively proportional to seats in the European Parliament](https://citizens-initiative.europa.eu/thresholds_en)) and requires the petition to clear minima in at least seven member states. The class-set and class-thresholds structure encodes that shape directly: each member state is a class, the per-state minimum is its threshold, and the resolution SNARK's Boolean output is the "is the ECI valid" question. The ECI's [Annex III Part B requirement](https://citizens-initiative.europa.eu/data-requirements_en) (national ID or passport number for 18 of 27 member states) is what the protocol replaces: the credential layer holds the identity attestation off-chain, the petition layer holds only the count.

[GDPR Article 25](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679#d1e3024-1-1) (data protection by design and by default) is the regulatory hook for any European-funded operation. The per-petition forward secrecy, the absence of an on-chain signer registry, and the cryptographic enforcement of class-binding are Article 25-shaped properties; the protocol's data minimisation is enforced in code that an operator cannot later undo by changing policy. For civil-society applications, the [ICRC Handbook on Data Protection in Humanitarian Action (3rd ed, 2024)](https://www.icrc.org/en/data-protection-humanitarian-action-handbook) is the sectoral reference; its chapters on data minimisation, third-party access requests, and shielding beneficiaries from re-identification each map onto a design choice here.

The protocol cannot make any operator legally compliant by itself. What it can do is make a class of compelled-disclosure orders technically meaningless, because the operator does not hold what the order asks for.

## Architecture

| Layer | Tools |
| --- | --- |
| Circuits | [Noir](https://noir-lang.org/), [UltraHonk](https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg), [recursive verification](https://barretenberg.aztec.network/docs/explainers/recursive_aggregation/) |
| Contracts | Solidity, [Foundry](https://getfoundry.sh/), [Indexed Merkle Tree (Aztec)](https://docs.aztec.network/aztec/concepts/storage/trees/indexed_merkle_tree) |
| Client | Rust, [Alloy](https://github.com/alloy-rs/alloy), [c-kzg](https://github.com/ethereum/c-kzg-4844) |
| Hashing | [Poseidon](https://www.poseidon-hash.info/) (BN254), Keccak-256 |
| Data availability | [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) blob carriers, [point-evaluation precompile](https://eips.ethereum.org/EIPS/eip-4844#point-evaluation-precompile) (0x0a) |
| Forward-security | [Bellare-Yee FSPRG](https://eprint.iacr.org/2001/035) over Poseidon sponge, [Szydlo tail-node traversal](https://www.szydlo.com/szydlo-loglog.pdf) |
| Credential layer | [ResilientIdentity](/resilient-plural-identity/) (Merkle root R) |

Three Noir circuits do most of the work. The signer circuit proves attribute satisfaction against the petition's predicate, FSRT slot membership, and correct nullifier construction. The batch circuit recursively verifies every signer proof in the batch, advances both IMTs (running root and identity-tag set), and binds the BN254 record decomposition to BLS12-381 blob field elements. The resolution circuit iterates over every leaf in the final running root, recomputes the canonical leaf hash from the witnessed pair, and tallies per-class counts. All three use UltraHonk with a universal SRS from Aztec's Ignition ceremony; no per-circuit trusted setup is required.

The `PetitionRegistry.sol` contract is the on-chain state machine. It holds petition records, batch records, IMT roots, and resolution outputs. It verifies batch and resolution SNARKs, validates KZG openings against blob versioned hashes via the `0x0a` precompile, and enforces the lifecycle transitions (`Registered` -> `SigningOpen` -> `SigningClosed` -> `Cooldown` -> `DisputeWindow` -> `Resolved` or `Unresolved`) at every entry point.

## Threat model

The properties below describe the target architecture in which signer-to-relayer and relayer-to-L1 transport runs over Tor, Nym, or HOPR. The Limitations section enumerates what the PoC ships without.

| Adversary | What they see | What they cannot do |
| --- | --- | --- |
| Public observer | Petition records, batch records, IMT roots, blob payloads (within retention), per-class counts, outcome bits | Link a signature to a specific signer beyond the cardinality of signers in R whose attributes satisfy the petition and whose class attribute matches a class tag in the petition |
| Compelled organiser | The petition's public parameters and the on-chain bounty escrow | Produce a signer list (no signer list exists); revoke or alter an already-published batch |
| Compelled or breached relayer | Per-submission signer SNARK and the (nullifier, identity_tag, class_tag) tuple; the inbound network origin, which anonymous transport has stripped of any signer IP | Forge a signature without the signer's RI leaf and FSRT chain; front-run a different submitter (the proof binds public inputs to the petition record); link two submissions from the same signer across petitions beyond the predicate-match intersection bound; build a practical submission list from its records, since anonymous transport severs each submission from any signer IP |
| Resolver | Public blob contents (within retention or from voluntary archive), running root, leaf count | Compute an outcome that the resolution SNARK does not commit to; identify a specific signer from the leaf set |
| Compelled or breached signer device (after slot k's petition dispute window closes) | Current ratchet head, caterpillar frontier, RI credential, attribute vector | Recover the slot k seed material (zeroised); produce a second signature for petition at slot k (nullifier already consumed on-chain) |

Honest-party assumptions: EIP-4844 blob commitment binding; L1 censorship-resistant inclusion and finality; permissionless relayer entry, so signers can resubmit if a specific relayer censors; sybil resistance from the RI credential layer; at least one honest reachable relayer per signing attempt; voluntary blob archives or EthStorage retain payloads beyond 4096 epochs for petitions whose resolution depends on it.

Out of scope: network-transport anonymity beyond what Tor or an equivalent mixnet provides; real-time device compromise before the petition's dispute window closes; forensic recovery of overwritten storage on commodity media without `TRIM`.

## Limitations

This is a proof of concept and the limitations are real.

**Circuit sizing.** The PoC caps the batch circuit at 6 signatures per batch and the resolution circuit at 200 leaves; the specification permits 100 and a deployment-specific calibration respectively. The recursive UltraHonk verifier's constraint count scales linearly in `BATCH_SIZE_MAX`, and the PoC caps keep proving tractable on a developer laptop. Production rebuilds both circuits at spec scale; the Solidity verifier ABI and protocol semantics stay unchanged.

**Self-declared attributes.** The signer's attribute vector should use recursive per-source link circuits (the same construction the identity post points at), so the petition layer inherits attribute correctness from the source.

**FSRT eager expansion.** The PoC materialises all 2^24 per-slot values in RAM at enrolment to compute the chain root. A production deployment streams the expansion and retains only the caterpillar frontier; the current shape is fine for testing and does not fit a smartphone.

**FSRT secure storage.** The signer's local FSRT state (current ratchet head, caterpillar frontier, atomic journal, identity secret) lives on the signer's device, and is only as durable against compromise as that device's storage. A device read before slot `k` is consumed and its seed material overwritten admits a signature on slot `k` by the attacker. The mitigation surface varies sharply by device class, and any deployment must answer how it stores this state.

**Relayer economic model.** The protocol pays the resolver via the bounty; relayers are not directly compensated by the protocol. A production deployment needs an answer (a per-record commission, a per-batch fee, or a sponsor-pays model). Each choice has different privacy consequences, and the trade-off belongs to the deployment.

**Cross-petition unlinkability bound.** The unlinkability argument is conditional on the cardinality `k` of signers in R whose attribute vector satisfies both petitions' predicates *and* whose class attribute matches each petition's published class tag. For petitions with small or unusual class sets, `k` may drop below 10 in absolute terms, and within a single petition a class containing only a handful of signers is effectively de-anonymising for everyone in that class. Production deployments on niche topics should pair the protocol with relay-side delay queues and mixnet transport, and either enforce a minimum-cohort size per class or fold low-cardinality classes into a residual bucket.

**Anonymous transport.** Today, a signer-to-relayer submission carries the signer's network origin to the relayer in the clear, and the relayer's network origin carries to L1. Production deployments require Tor, [Nym](https://nym.com/), or [HOPR](https://hoprnet.org/) on both legs; the protocol's transport interfaces are designed for this substitution and the PoC ships an in-process direct-submission adapter.

**Aggregate participation timing.** A signer who participates in many petitions publishes one nullifier per petition, each timed to L1 block production. An observer correlating publish times across petitions can estimate aggregate participation frequency for individual signers, even when no individual signature is linkable to a person. Mitigation is the same family of techniques as for transport: per-signer mixnet delays and randomised relayer selection.

**Long-term blob availability.** EIP-4844 retains each batch's blob payload for ~18 days from that batch's own publication, while resolution opens 14 days after close-at-block. With signing windows up to 11.5 days, batches published more than 4 days before close are already past consensus retention at resolution time, so any non-trivial petition depends on voluntary archives or EthStorage for at least part of its batch set. The on-chain batch SNARK commitments still bind blob payloads to versioned hashes, so a re-served archive copy is verifiable. The cost is one extra trust assumption.

## Related work

A few lines of prior work sit close to this one.

[MACI](https://maci.pse.dev/) (PSE, [proposed by Vitalik in 2019](https://ethresear.ch/t/minimal-anti-collusion-infrastructure/5413)) is the most-deployed on-chain anti-collusion voting framework. It runs a coordinator that re-encrypts votes during the round to defeat bribery. This protocol removes the coordinator role: tallying is derivable from chain state alone, and unlinkability does not require a live operator. The two differ in shape (vote vs petition) and in their trust model around the coordinator. [Cicada](https://a16zcrypto.com/posts/article/building-cicada-private-on-chain-voting-using-time-lock-puzzles/) (a16z 2023) hides per-option running tallies via linearly-homomorphic time-lock puzzles; the petition protocol here hides each signer's identity at all times, and the final per-class counts are deterministic from blob data with no time-lock dependency. The two designs are complementary. [CRISP](https://docs.theinterfold.com/CRISP/introduction) (Interfold, formerly Enclave) combines BFV homomorphic encryption for encrypted tally aggregation with Noir and RISC Zero proofs for vote validity, and runs an optional-bypass coordinator; the petition protocol here keeps per-class counts public by design (they are the outcome) and removes the coordinator role entirely.

[Semaphore](https://semaphore.pse.dev/) (PSE) is the canonical ZK group-membership primitive. The signer SNARK here extends it with per-petition nullifiers, per-slot ratchet values, and class-conditional inclusion proofs. [PLUME](https://eips.ethereum.org/EIPS/eip-7524) (ERC-7524) is the most-deployed nullifier-from-existing-key primitive; the protocol's nullifiers bind to (petition, slot, ratchet value), so the same key produces unrelated nullifiers across petitions.

[zk-creds](https://eprint.iacr.org/2022/878) (Rosenberg et al. 2023) and [zk-promises](https://eprint.iacr.org/2024/1260) (Shih et al. 2025) cover anonymous credentials and stateful callback patterns over existing identity documents. This protocol consumes a zk-creds-shaped credential through the RI layer and adds per-petition forward secrecy on top. [OpenAC](https://eprint.iacr.org/2026/251) (EF/PSE 2026) adds unlinkable presentation over SD-JWT and mDL credentials, with the EUDI Architecture Reference Framework as its compatibility target; the petition protocol composes OpenAC-style presentations into class-threshold tallies. [Coconut](https://arxiv.org/abs/1802.07344) (Sonnino et al. 2019) is the canonical prior-art reference for threshold-issued anonymous credentials with an explicit electronic-petition application; the difference is operational: this protocol's bulletin board is L1 plus blobs, and tallying happens via a resolution SNARK where Coconut uses a homomorphic aggregate.

[Gitcoin Passport / Human Passport](https://passport.human.tech/) aggregates web2 accounts, web3 holdings, and biometric proofs into a sybil score. [BrightID](https://www.brightid.org/) provides social-graph sybil resistance. [Sismo zkBadges](https://github.com/sismo-core) (sunset 2023; smart contracts open source) aggregates per-account credentials into source-bound badges. Any of these can supply the credential layer the petition layer composes against; the petition layer is agnostic to the sybil-resistance mechanism inside R.

[Helios](https://www.usenix.org/conference/17th-usenix-security-symposium/helios-web-based-open-audit-voting) (Adida 2008) is the first web-based open-audit voting system with homomorphic tallying. [Belenios](https://www.belenios.org/) (Inria/CNRS/Université de Lorraine) is a general-purpose verifiable voting system widely deployed for academic and institutional elections, with threshold trustees. [Open Vote Network](https://homepages.cs.ncl.ac.uk/feng.hao/files/OpenVote_IET.pdf) (Hao, Ryan, Zieliński 2010) is the self-tallying boardroom-scale protocol with no tallying authority. All three trust a bulletin-board operator, a trustee committee, or a small group size; this protocol treats Ethereum L1 plus blobs as the bulletin board and eliminates the trustee role.

The [European Citizens' Initiative](https://eur-lex.europa.eu/eli/reg/2019/788/oj/eng) (Regulation (EU) 2019/788) is the regulatory shape this protocol is designed to fit. Swiss [federal e-collecting trials](https://www.swissinfo.ch/eng/swiss-democracy/green-light-for-electronic-signature-collection-trials/90790010), authorised after the 2024 signature-forgery scandals, are a parallel direct-democracy effort. Their deduplication runs against electoral registers; this protocol uses per-petition nullifiers. The [MIT Specter-Koppel-Weitzner 2020 audit](https://internetpolicy.mit.edu/wp-content/uploads/2020/02/SecurityAnalysisOfVoatz_Public.pdf) of Voatz and the [Halderman et al. 2014 audit](https://jhalderm.com/pub/papers/ivoting-ccs14.pdf) of Estonia's i-voting system documented passive-network deanonymisation, ballot alteration, and structural trust assumptions that motivate moving integrity-critical state on-chain.

The forward-secure construction sits in a well-trodden family. [Bellare and Yee 2003](https://eprint.iacr.org/2001/035) is the formal foundation for forward-secure PRGs; [Szydlo 2004](https://www.szydlo.com/szydlo-loglog.pdf) is the log-space Merkle traversal that keeps signer state bounded. The [Signal Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) composes a symmetric-key KDF chain (for forward secrecy) with a Diffie-Hellman ratchet (for post-compromise security); [MLS TreeKEM (RFC 9420)](https://www.rfc-editor.org/rfc/rfc9420.html) extends forward secrecy to groups of thousands with continuous key agreement. The FSRT used here is non-interactive and tree-shaped (one leaf consumed per signature), so a SNARK can verify a per-slot value without rebuilding state from genesis.

For data availability, [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) is the substrate; [EIP-7594 (PeerDAS)](https://eips.ethereum.org/EIPS/eip-7594) raises the blob ceiling under Fusaka, which is what makes ECI-scale petitions feasible in a single round; [Blobscan](https://blobscan.com/) and [EthStorage](https://ethstorage.io/) are the candidate long-term archives. For recursion, [Aztec UltraHonk](https://barretenberg.aztec.network/docs/explainers/recursive_aggregation/) is the proving system.

[Snapshot](https://docs.snapshot.box/), [Tally](https://docs.tally.xyz/), and [Aragon](https://www.aragon.org/) are the existing on-chain governance tools. Snapshot's authoritative state is IPFS-hosted signed messages; Tally and Aragon are pseudonymous and per-token. This protocol sits adjacent: it produces anonymous, class-thresholded petition outcomes with no per-signer on-chain footprint and durable verifiability beyond any operator's lifetime. [Optimism Citizens' House and Retro Funding](https://community.optimism.io/citizens-house/how-retro-funding-works) (formerly RetroPGF) encode plural-identity public-goods funding under a single jurisdiction's roster; this protocol encodes plural-class petition outcomes under an external credential root.

For transport, [Tor](https://www.torproject.org/), [Nym](https://nym.com/), and [HOPR](https://hoprnet.org/) are the candidate substrates for the signer-to-relayer and relayer-to-L1 hops.

## Closing the series

The series covered three brittle pieces of state. Identity that depends on an authority who will eventually stop signing. Payments that depend on a rail that can be subpoenaed at the off-ramp. Civic participation that depends on a signer list that someone will eventually publish. Each post replaced the live authority with an on-chain Merkle root and a SNARK that proves statements against it. Where a central database used to hold long-lived static records, the resilient stack keeps per-holder secrets that never leave the holder and forward-secure state that advances as the protocol does.

This is not always the right tool. [MACI](https://maci.pse.dev/) handles per-vote bribery during an active round, since its coordinator re-encrypts votes mid-round; this protocol cannot. [Cicada](https://a16zcrypto.com/posts/article/building-cicada-private-on-chain-voting-using-time-lock-puzzles/) hides the running tally with time-lock puzzles; here the count is derivable from blob data the moment a batch enters state. And in jurisdictions where surrendering national identifiers to a state verifying authority is mandatory and the retaliation threat is acceptable, the EU's centralised ECI deduplication will be cheaper to run. This protocol fits the narrower case where the list itself is the threat and the operator wants to answer a future subpoena with "we do not hold what you are asking for" as a technical fact.

The pieces compose. A holder enrolled in [Resilient Plural Identity](/resilient-plural-identity/) can be a recipient in [Resilient Disbursement Rails](/resilient-disbursement-rails/) and a signer in this protocol, all under the same credential root, with none of the three operations producing a record the others can be joined to. The resilience stack is the one where no single layer being captured collapses any other.

## Working with us

If you are running a humanitarian organisation, a govtech platform, a civil-society campaign, an NGO, or a regulator with a use case where the existence of a list is itself the risk, we want to hear from you. The three protocols described in this series cover identity continuity, private disbursement, and credentialed petition signing; the wider [IPTF Map](https://github.com/ethereum/iptf-map) catalogues a broader set of primitives that Ethereum can support. Reach out by [opening an issue](https://github.com/ethereum/iptf-pocs/issues) on the PoC repository, or via the contact information on the [IPTF home page](https://iptf.ethereum.org/).

The [specification](https://github.com/ethereum/iptf-pocs/blob/master/pocs/civic-participation/resilient-civic-participation/SPEC.md) has the full circuit constraints, contract semantics, and security considerations. The IPTF Map [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/resilient-civic-participation.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-civic-participation.md) documents place this in the broader institutional-privacy work.

[^1]: Other documented cases:

    - Cuba's [Varela Project](https://en.wikipedia.org/wiki/Varela_Project) collected 11,000 signatures in 2002; the March 2003 "Black Spring" jailed 75 dissidents in total, 25 of them Varela organisers, with sentences of 6 to 28 years.
    - After Alexei Navalny's Anti-Corruption Foundation was branded "extremist" in 2021, Russian security services used the foundation's Stripe merchant ID, visible on donor bank statements, to drive [more than 100 criminal cases](https://en.zona.media/article/2025/10/15/donors); the financial rail itself became the signer list.
    - In Belarus in mid-2020, UN experts reported around [500 people detained for giving or collecting signatures](https://monitor.civicus.org/explore/opposition-candidates-and-supporters-persecuted-detained-ahead-elections/) to nominate opposition candidates.
    - Turkey jailed academics for [signing a peace petition](https://www.hrw.org/news/2016/03/16/turkey-academics-jailed-signing-petition) in 2016.
    - In January 2021, Hong Kong arrested 53 people involved in an unofficial pro-democracy primary under the National Security Law; 47 were charged and [45 were sentenced in November 2024](https://news.un.org/en/story/2024/11/1157166).
    - Washington's Referendum 71 supporters argued before the U.S. Supreme Court that disclosure would invite the same harassment Proposition 8 donors faced after their publicly disclosed campaign-finance records were aggregated and mapped on [Eightmaps.com](https://odimpact.org/case-united-states-eightmaps.html); the court declined facial relief but [acknowledged the threat](https://supreme.justia.com/cases/federal/us/561/186/).
