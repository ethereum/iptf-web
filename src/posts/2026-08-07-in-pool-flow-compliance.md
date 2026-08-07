---
layout: post
title: "Building Compliant Shielded Pools on Ethereum"
description: "A shielded pool that can prove it screened every payment."
date: 2026-08-07 15:00:00 +0200
author: "Aaryamann"
image: ../assets/posts/2026-08-07-in-pool-flow-compliance/hero.png
tags:
  - compliance
  - shielded-pool
  - sanctions-screening
  - transaction-monitoring
  - noir
  - zero-knowledge
  - proof-of-concept
---

A shielded pool hides who paid whom, and how much. An institution needs that. Its balances and its list of counterparties are competitive information, and a public ledger publishes both to anyone who cares to look.

The institution's supervisor needs close to the opposite. Real payments cannot go through such a pool until the supervisor is satisfied that every payment leaving it was screened against sanctions lists and monitoring rules. Today an institution can have the privacy or it can have that assurance. This proof of concept is an attempt at both.

Three earlier posts built the pool this one extends. [Private bonds](/blog/building-private-bonds-on-ethereum/) gave it a note format, [private transfers](/blog/building-private-transfers-on-ethereum-with-shielded-pools/) turned it into a payment rail, and [hardened shielded pools](/blog/exploring-hardened-shielded-pools/) went after the growing on-chain state and the leaky private read.

A compliance department can answer almost any question a supervisor asks about a payment the institution made. Name the transfer, and it produces the screening record. The question it usually cannot answer is the negative one: show that nothing went unscreened.

On a transparent ledger that question is bookkeeping, and the ledger answers it. On a shielded ledger it becomes a design question, because the ledger shows the institution only what the institution chose to record.

Shielded systems that screen today mostly put the screening proof beside the spend. The party sending value produces two artifacts. One proof says the payment conserves value. A second proof says the parties were checked against a list. The contract accepts both, and coverage rests on the sender having produced the second one.

An institution running that design can truthfully say it operates screening. It cannot say screening ran on every payment. The protocol never asked for it, so the absence of a screening proof looks exactly like a payment that was never made.

That gap is what this proof of concept closes. The compliance policy stops being an artifact the sender chooses to produce, and becomes a constraint inside the proof that moves the money.

## What we built

We took the shielded pool from the earlier posts and changed three things. Its underlying machinery carries over untouched. Value lives in notes, which are private records of who holds what, each one hashed into an append-only Merkle tree called the commitment tree. Spending a note means proving it sits in that tree and replacing it with new ones.

![The Compliance Authority issues cohorts of expiring attestations into a registry, whose root feeds the pool. The institution's own wallet builds a single proof carrying the spend, the screen and the policy together. The pool contract checks the destination blocklist and the public thresholds before verifying, then writes commitments, nullifiers and encrypted notes to Ethereum. An audit quorum of t of n can decrypt the compliance record from there.](../assets/posts/2026-08-07-in-pool-flow-compliance/what_we_built.png)

**The policy moved inside the circuit.** A deployment writes its ruleset as a small function. That function compiles into the same three circuits that prove a deposit, a transfer and a withdrawal. It reads a record of what the transaction is, and the pool constrains every field of that record.

**Each account carries a running total.** A compliance note holds one account's policy state for one epoch, which this deployment sets to one day. The note lives as a leaf in the commitment tree, chained across the day so that the account cannot restart it or lower it.

**Attestations expire.** An attestation is a signed, expiring statement from the Compliance Authority that a party passed its checks. The Authority reissues them each period for parties that remain compliant. Revocation is the absence of the next issuance.

Letting an attestation lapse sounds like a weaker control than deleting it from the registry, and it buys two things worth more.

The first is that the registry only ever grows. Nothing is removed, so a root published yesterday still describes a real registry today, and a proof built against it stays valid. Deleting a leaf would move the root and invalidate every proof already in flight, the honest ones included. Expiry avoids that, and it turns revocation latency into a number a deployment publishes and can be held to.

The second is that a check at the door that never repeats is not what a supervisor asks for. [FATF Recommendation 10](https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html) asks for due diligence throughout the relationship. An allowlist snapshot does not provide that. An expiry date does.

Expiry cannot reach backwards and cancel an attestation already issued, so two levers sit behind it. Governance can revoke a compromised issuer as of a given day, which invalidates every attestation that issuer signed. Retiring the whole attestation tree at once, behind a timelock, answers a mass mis-issuance.

The [specification and implementation](https://github.com/ethsystems/pocs/tree/master/pocs/private-payment/shielded-pool-compliance) are open.

## Screening you cannot skip

The argument is one sentence long. If the policy is a function inside the circuit, then a transaction the policy refuses has no satisfying witness, no set of private inputs that makes the circuit check out, so no proof of it exists and nothing reaches the chain.

Compare that to the alternative and the difference is not a matter of degree.

![Two panels. Above, screening beside the spend: the sender produces a spend proof and a separate screening proof, the contract accepts both, and coverage depends on the sender having produced the second one. Below, screening inside the spend: the sender produces a single proof carrying conservation, the screen and the policy together, so a blocked transaction has no satisfying witness and no proof exists to submit.](../assets/posts/2026-08-07-in-pool-flow-compliance/beside_vs_inside.png)

A proof of a shielded spend already carries a conservation argument. Value in equals value out, and the prover cannot lie about it, because a lie leaves the circuit unsatisfiable. Putting the policy in that same circuit gives the policy the same standing. Coverage becomes as hard to bypass as conservation of value, because the same mechanism enforces both.

What the policy reads is a record the pool builds and constrains. This is the whole extension point:

```rust
/// What the pool proves about this transaction. Pool-owned, fixed for all policies.
struct TxFacts {
    epoch:        u64,        // the day this transaction lands in
    seq:          u64,        // position in the sender's chain, this day
    token:        Field,      // the deployment's single token
    subject:      Field,      // the sending party's attested public key
    counterparty: [Field; 2], // the receiving parties' attested public keys
    value_in:     u64,        // value entering the sender
    value_out:    u64,        // value leaving the sender
    exit:         Field,      // the destination address, on a withdrawal
}

/// A policy is three functions and one number.
global K: u32;                                 // how many state slots it keeps
struct State { s: [u64; K] }

fn zero() -> State;                                          // where a day starts
fn advance(prev: State, tx: TxFacts) -> State;               // what to remember
fn evaluate(tx: TxFacts, prev: State, next: State) -> u64;   // what to do about it
```

Every field is bound to something the circuit already proved or the contract already checked. Take `subject`. It is the public key derived from the spending key that authorized the spend. A sender therefore cannot name the recipient as the subject and pass the screen using the recipient's credential. `value_out` counts only outputs going to somebody other than the subject, so change returned to the sender's own account does not read as an outbound payment.

`exit` is the withdrawal destination the contract itself sees. Leave any one of these as a free witness and the control reading it becomes decorative.

`evaluate` returns a bit vector. Setting a bit records that a rule fired. The pool binds that vector into the committed state before admitting the transition. A flag raised is a flag the sender cannot later deny raising.

One clarification, since the distinction is easy to lose. The interface lets a policy refuse a transaction outright, by asserting. The ruleset we ship refuses nothing, and only records. Every prohibition here sits elsewhere. Sanctions screening lives in the attestation gate, which the pool owns and no policy can reach. Destination blocking lives in a contract mapping, read at the moment of execution.

Screening reduces to attestation membership, which is why it is cheap. The usual way to prove a party is not sanctioned is to prove it is absent from a blocklist. Absence is the expensive direction. The list has to be kept sorted, and the proof has to show the party's key falls in the gap between two neighboring entries. Here the Compliance Authority has already checked the party against those lists, and issued the attestation only because the check came back clean. Membership therefore carries what non-membership would have proved. There is no sorted tree and no range bracket. There is one Merkle inclusion the circuit was going to do anyway.

## A total the account cannot reset

Coverage says the policy ran. It says nothing yet about what the policy was able to see. A rule that reads one transaction at a time catches only what one transaction reveals. The patterns supervisors care about are almost never visible that way.

So the pool carries state. Each account gets one compliance note per day, holding whatever its policy chose to remember, and the notes chain.

<div class="figure-narrow">

![A day's compliance chain for one account. The chain starts from the policy's zero state at sequence position zero and advances through successive compliance notes, each transition spending a velocity nullifier for its position so the position can never be reused. The running total climbs from zero through 120 and 340, where an aggregate threshold flag is set, to 410. At the day boundary the chain restarts from zero again for the next epoch.](../assets/posts/2026-08-07-in-pool-flow-compliance/epoch_chain.png)

</div>

The chaining works through a value we call a velocity nullifier, derived from the spending key, the day, and the position in the chain. It goes into the pool's existing nullifier mapping, the same one that stops a note from being spent twice. Position three of Tuesday's chain can be consumed once, by the key that owns it, and never again.

That single mechanism does the work, and the reason takes a moment to see. The account holder owns the spending key. The holder can therefore produce a velocity nullifier at any position legitimately, which sounds like the end of the argument. Follow the three ways out and none of them opens.

To fork the chain, the holder has to spend a position twice. The mapping rejects that. To park an old note and reopen it later with a smaller total, the holder has to mint a note the circuit never derived from its predecessor. The commitment tree admits only circuit-computed leaves. To carry yesterday's low total into today, the holder has to start at position zero, and position zero asserts the policy's zero state.

What survives all three is the honest chain. The running total is fixed inside the day by exactly the argument that fixes the value of a note.

The reference ruleset uses that state for the obvious thing. It keeps one number, the cumulative value leaving the account today. It sets one flag when a single transaction crosses a threshold, and a second when the day's total does. Adding a rule means raising the slot count, naming a slot, and adding a line. The circuits and the contracts stay as they are.

None of this is visible from outside. An observer sees one more commitment in the tree and one more entry in the nullifier mapping. The total, the flags and the counterparties sit in a payload encrypted to the account and to an audit quorum.

Reading that payload takes a threshold of the quorum acting together. Each member returns a partial decryption, and the auditor combines them. The quorum also publishes a hash of what it authorized, naming the subject and the range of days it covers. Nobody can widen the grant afterwards and claim it was always that broad. Fewer than the threshold learn nothing. The quorum deliberately excludes the Compliance Authority, which is the one party that can already map a public key to an institution. Keeping identity and amounts in different hands is the point of that exclusion.

## Where it stops

The clearest way to see the boundary is to walk a case through it.

An attested institution moves nine transfers on Monday, each just below the single-transaction threshold. This is the case the design was built for. Every transfer advances the same chain. The ninth pushes the day's total past the aggregate threshold, the circuit sets the flag, and the subject cannot afterwards deny it. Same-day aggregation is the control at [31 CFR 1010.313](https://www.law.cornell.edu/cfr/text/31/1010.313), scoped to any one business day. That is why the epoch is a day.

On Tuesday the same institution does it again.

Tuesday's chain starts at position zero, and position zero asserts the policy's zero state. Monday's total is not an input to it. Nothing fires. Any experienced supervisor would recognize the pattern on sight, and no rule this pool can express sees it at all. The pool owns the reset, and no conforming policy reaches across the day boundary.

[31 U.S.C. 5324](https://www.law.cornell.edu/uscode/text/31/5324) reaches exactly this: splitting a sum to stay under a threshold. The reference ruleset models that family of controls. It does not implement a binding one. We would rather say so than let the word "aggregation" carry an implication it has not earned.

The fix is known and unbuilt. A transition would carry a predecessor from an earlier day and consume that chain's head alongside the current position. That extends the accumulator's reach without giving up the single-use property. Earlier positions in the old chain are already spent, so the head is the only predecessor still reachable. The cost is one more inclusion proof, and a thread an observer can pull. A transition that reaches back has to point at one specific earlier chain, and whatever the transaction publishes to identify that predecessor joins two days the daily reset had kept apart.

## Related work

| Work | What it shares | Where it differs |
|---|---|---|
| [Zeto](https://github.com/hyperledger-labs/zeto) | The nearest neighbor. Checks sender and every receiver against one identities root, in-circuit and mandatory | Carries no state across transactions, no attestation expiry, and no versioned commitment to the ruleset in force |
| [Platypus](https://eprint.iacr.org/2021/1443) | Per-account per-period limits, where the period costs nothing in linkability | Account-based, so the state lives in an object its online holder updates. Chaining state as public leaves in a shared tree makes linkability a function of the period |
| [zkAML](https://eprint.iacr.org/2025/465) | Allowlist screening evaluated in a contract | Leaves mandatory and optional coverage unspecified, which is the axis this design is about |
| [Hurricane Mixer](https://eprint.iacr.org/2025/1659) | Sanctions non-membership proven in the same proof as the spend | Blocklist-based and stateless, with two-way tracing built in |
| [Railgun Private Proofs of Innocence](https://docs.railgun.org/wiki/assurance/private-proofs-of-innocence) | Screening against curated sanctions and scam lists, proven without revealing the user | A separate recursive proof alongside the spend, checked by broadcasters and PPOI nodes rather than by the pool contract. Blocklist over fund provenance, with no accumulator over flow |
| [Privacy Pools](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364) | A withdrawal proves association-set membership inside the spend proof, so the check cannot be skipped | The set is provenance over deposits, and the spender picks which provider's set to prove against, so the pool fixes the mechanism and not the standard. Stateless across withdrawals |
| [Proof of Source of Funds](https://arxiv.org/abs/2606.10172) | A compliance proof the user produces | Reasons about provenance over a value-flow graph. This design reasons about the parties at the moment of payment |

The velocity nullifier is the serial number from [compact e-cash](https://eprint.iacr.org/2005/060), restricted to one account for one day. Carrying an accumulator alongside the serial turns that construction's limit on how many times you can spend into a limit on how much. The general shape of this, with callbacks, is [zk-promises](https://eprint.iacr.org/2024/1260). Read the whole category as [ERC-3643](https://eips.ethereum.org/EIPS/eip-3643) compliance-module semantics moved inside a shielded pool and given memory.

## What the pool cannot promise

Three limits belong in the same voice as the claims.

**The record is readable only because somebody is liable.** The circuit constrains the compliance state and commits to it. It does not constrain the ciphertext. A subject can encrypt something other than the truth and no verifier catches it, because no circuit reads the encryption.

Coverage is enforced by mathematics. Readability is enforced by an obligation on a regulated party, and by whatever follows from handing a supervisor a record nobody can open. The two are not the same strength, and a deployment that treats them as interchangeable has misread the design.

**The anonymity set is bounded by the cohort.** A transfer screens the sender and both receiving parties. Both ends of every payment therefore come from a publicly enumerable set of attested keys. At fifty to five hundred keys that is roughly six to nine bits of uncertainty, and volume does not improve it. Read plainly: an observer cannot see what a payment was, but can narrow either end of it to one of a few hundred known institutions. This is inherent to gating a pool on identity. Cohort size is the only parameter that moves it.

**One account, one transaction at a time.** The chain is serial by construction. An institution sustains at most one gated operation per block, plus proving time. Two of its transactions cannot occupy the same window, which tells an observer that two payments in the same block came from different senders. Sharding the chain into parallel lanes raises the throughput and weakens the aggregate control by the same factor. That trade is not resolved here.

Alongside these sits the ordinary state of a proof of concept. This is research code, and it is unaudited. The threshold encryption is a placeholder standing in for a committee of one. The [specification](https://github.com/ethsystems/pocs/blob/master/pocs/private-payment/shielded-pool-compliance/SPEC.md) lists five open questions an implementation has to answer first. The one we find least comfortable is entirely off-protocol. When an attestation lapses, the party's funds reach a blocked account, and nothing in this protocol says who releases them.

## Closing

The screening a shielded pool does is worth exactly what the pool can prove about it. Beside the spend, screening is a claim. Inside the spend, coverage becomes as hard to bypass as conservation of value, because the same mechanism enforces both. Everything else in this design follows from putting it there.
