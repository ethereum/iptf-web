---
title: "The Next Iteration of Shielded Pools"
description: "What stands between a working shielded pool and private payments people could use every day: on-chain state, getting spends included, the wallet's read and proving load, and post-quantum security. Plus a proof-of-concept that takes on two of them, with private information retrieval and epoch-based nullifiers."
date: 2026-06-11
author: "Yanis"
image: /assets/images/2026-06-11-next-iteration-shielded-pools/hero.png
published: false
---

Shielded pools are how you make a private payment on a public blockchain. Two earlier posts on this blog built one, first for [private bonds](/building-private-bonds-on-ethereum/), then for [private payments](/building-private-transfers-on-ethereum/). The primitive works. What comes next is a run of bigger iterations meant to make it both more resilient and more scalable: hard for any single party to watch, censor, or quietly take control of, and fast enough to carry payments at Visa scale. The trick is getting there without giving up the four things that make shielding worth having in the first place: censorship resistance, openness, privacy, and security.

A shielded pool has a few moving parts, and each is where that gets hard. Through a wallet, it writes and reads the Ethereum contract state. And it proves, on the user's own device, the zero-knowledge proof that makes each spend valid, which is also where the post-quantum question bites. We will walk the open problems, then go deep on the two our prototype takes on.

## The open problems

Shielded pools already move billions in value. The open question is whether they can carry private payments at scale: fast, cheap, and decentralized, the way a real payment network has to be. A few problems stand in the way.

On-chain state never stops growing. Every spend writes a nullifier to Ethereum, a short value that marks a note as spent so it can never be spent twice, and it has to stay there permanently, because the whole point is to remember forever. At payment volumes, say 150 million transactions a day, that is around 5 gigabytes a day in nullifiers alone, with no end date. [Bowe and Miers](https://eprint.iacr.org/2025/2031) work through the arithmetic, and the conclusion is plain: storing that much data on Ethereum forever, and asking everyone who validates a spend to keep consulting it, does not hold up. Epoch-based nullifiers are the most promising way out, though the tooling for them does not exist off the shelf yet.

Censorship resistance is a problem of its own, with two ways to go wrong: paying for a spend, and getting it included. If you pay gas from your own address, you have tied yourself to your private spend, so today a relayer pays and submits for you. That works, but it makes the relayer a chokepoint that can stall, refuse, or be compelled to, and even past the relayer, whoever builds the block can simply leave your transaction out. Two proposed changes to Ethereum address both ends. Frame transactions with keyed two-dimensional nonces let a user pay and submit directly while keeping the gas payer separate from the spender. The FOCIL inclusion-list mechanism forces blocks to include eligible transactions, so a private spend cannot be quietly censored. ([EIP-8141](https://eips.ethereum.org/EIPS/eip-8141), [EIP-8250](https://ethereum-magicians.org/t/eip-8250-keyed-nonces-for-frame-transactions/28437), [EIP-7805](https://eips.ethereum.org/EIPS/eip-7805).)

The wallet carries more than you would think, and users feel it. Open an app you have not touched in a few weeks and it has to pull every recent note and try to decrypt each one before it can show a balance, because nothing on the outside says which notes are yours. On a busy pool that is minutes of waiting. And each time the wallet reads from the chain to build a spend, it does so through some provider that sees your address and your requests.

Then there is the proof itself. Many shielded pools prove spends with Groth16, whose proofs are tiny and cheap for Ethereum to verify, but whose security a large quantum computer would break, and with it the soundness of every spend. The fix is a post-quantum proof system, which tends to be heavier, and that weight lands on the user's device, the same one already doing all that scanning. Nobody knows the timeline. Money is supposed to outlast the question.

No design solves all of these at once, and pretending otherwise is how you ship something elegant and unusable. Our prototype takes two: the on-chain state, and the private read.

## What our prototype takes on

We built an extension on top of the working pool from the last post, keeping its note format and flows intact, and pointed it at two of those problems: keeping the on-chain state bounded, and letting a wallet read what it needs without anyone watching. The full [specification and implementation](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-payment/shielded-pool-extension) are open.

The rest of this post follows a spend through both, starting with the read.

## Reading without being watched

Before a wallet can spend a note, it has to fetch the note's place in the commitment tree, the running list of every note ever created, and show the note is really in there. The proof that follows is airtight. The fetch is not. To get that data, the wallet asks a provider, a company like Infura that runs a node so you do not have to, and the request leaks twice. From your IP address, the provider learns you use the pool at all, no identity needed. From what you ask for, it can narrow down which note you are about to spend. The best on-chain privacy in the world can be undone by how the wallet reads around it.

What we want is a way to read one row of a database without the operator learning which row. That exists.

### PIR, in plain terms

It is called Private Information Retrieval, PIR, and the cleanest picture is a librarian. You want one specific book, but you would rather the librarian not know which, because the record of what you read is sensitive on its own. PIR lets you hand over a request, encrypted so the librarian can run the search across the whole library and pass back the right book, without ever learning which one it was. Under the hood, the database is a table of rows, you encrypt the index you want, the server does math over the entire table with your encrypted index, and you get back an encrypted answer only you can open. The server cannot tell row 5 from row 5,000.

The catch, and it matters in a minute, is that PIR answers exactly one question: give me row i, where you already know i.

### Fetching a note's path blindly

That is exactly the question our wallet needs to ask. When you received a note, you learned its position in the commitment tree from the payment that created it, so you know the index. To read its authentication path privately, we lay the tree out as a flat array, following [tree-pir](https://github.com/brech1/tree-pir), and the wallet sends a small batch of PIR queries, one per sibling on the path to the root, about log(N) of them for a tree of N notes. The server returns them and learns nothing about which leaf they belong to.

### What it costs

None of this is free. PIR makes the server work over the whole database on every query, and schemes differ in how much precomputation each side keeps. The specification targets a recent scheme, InsPIRe, whose appeal is that it needs no per-database hint on the client. Our prototype ships an older, simpler one, SimplePIR, which gives the same privacy but does keep a hint on the client, derived from the public database. That hint is not a secret, so losing your phone loses nothing sensitive: you recompute or re-download it, and it has to be refreshed as the database grows. For real figures, the [PSE writeup on scaling Semaphore with PIR](https://pse.dev/projects/scaling-semaphore-pir) and the tree-pir benchmarks are the places to look. PIR is practical enough to build with today, and getting cheaper.

## The server you don't have to trust

So who is this server, and why trust it? Mostly you do not have to. On-chain, the contract keeps only a Merkle root, a single short fingerprint of every note. The server rebuilds the full tree from Ethereum's public event log and serves it, but it cannot lie, because the wallet checks whatever it returns against that root, and it gets the root from a light client that verifies it against Ethereum's consensus instead of trusting the server.

```
// The wallet trusts a root from consensus, not from the server.
root    = lightClient.verifyStorageSlot(pool, ROOT_SLOT)  // eth_getProof, checked against a finalized header
rebuilt = hashUp(nodes_from_server)                        // reassemble the path the server returned
assert rebuilt == root                                     // a lying server fails right here
```

A dishonest server can refuse to answer, but it cannot forge your data, and since the data is public, anyone can run their own. Availability is solved by decentralizing it, not by trusting any one operator.

The light client closes the correctness gap, not the privacy one. It proves the data is right. It does nothing to hide that you asked this provider for this contract's state in the first place, which is the same metadata leak we started with. Closing that needs cover at the network layer, a mixnet or Tor between the wallet and the provider. The Kohaku wallet SDK for shielding protocols routes its RPC over Tor for exactly this reason, and the Ethereum Foundation's [privreads](https://privreads.ethereum.foundation/) effort studies private reads as a general capability.

## Keeping the ledger from growing forever

Now the write side, and the second problem we took on: keeping that permanent nullifier record from growing without bound.

### Closing the book each epoch

Think of accounting periods. Instead of one ledger that grows forever, you close the books at the end of each epoch, a month, say, and open a fresh one. The sealed book leaves only its Merkle root on-chain. The trick is in the nullifier itself, which now folds in the current epoch:

```
nullifier = hash(commitment, spending_key, epoch)
```

So the same note produces a different nullifier each epoch, and only the current epoch's set is live on-chain. The price for the tidiness: "not spent" now has to hold against every book the note has lived through, from the epoch it was created in to the present. Spend a two-year-old note and, done naively, you owe two years of monthly checks.

### Proving a clean history in one shot

This is where the construction earns its keep. Instead of redoing all those checks at spend time, the wallet keeps a small running proof for each note and extends it by one step whenever an epoch closes. The technique is incrementally verifiable computation, IVC: each new proof verifies the previous one inside itself, so a single proof attests to a note's clean history across every epoch so far. When you spend, the spend proof checks that one chain proof once, and the cost does not grow with the age of the note. To stop anyone gaming the edges, the note's commitment binds the epoch it was created in, so the verifier can insist the chain covers the note's whole life.

### Proving absence, and the catch it creates

A nullifier tree has to answer a harder question than the commitment tree. The commitment tree only asks "is this note present," and an ordinary append-only tree handles that. A nullifier tree has to prove a value is absent, and absence is the harder direction. The naive fix, a sparse tree with a slot for every possible value, is astronomically deep and forces a huge number of hashes per proof, which hurts inside a zero-knowledge circuit. The cheaper answer, and the one we use, is an indexed Merkle tree: leaves are kept sorted, each pointing to the next-larger one, and to prove a value is absent you point at the single leaf that should sit just below it and show the gap. The tree is only as deep as the number of values actually stored. Aztec's [documentation](https://docs.aztec.network/developers/docs/foundational-topics/advanced/storage/indexed_merkle_tree) covers it well.

But sorting breaks the clean PIR story. To prove your nullifier is absent, you first have to find that leaf just below it, its neighbor, and you do not know where it sits. Nobody told you its index, and finding it is not a "give me row i" question. For now our prototype steps around this for sealed epochs, where the values a wallet checks never appeared on-chain, by asking the server for them in the clear and accepting the metadata leak. Closing it properly needs a different primitive, and that is the hinge of the whole thing.

## The hinge: finding a leaf, finding a note

Look at the shape of what we just hit. PIR fetches a row when you already know its index. Finding that neighbor leaf is a different kind of request: you are asking the server to find, among everything it holds, the one value sitting just below yours, without telling it your value. PIR does not search, it fetches, so here it is necessary but not enough.

Now recall the other read-side problem, the cold wallet that takes minutes to find your money. It takes minutes because the wallet pulls every recent note and tries to decrypt each one, since nothing on the outside marks which are yours. You could ask the server to filter, but the thing that picks out your notes, your key, is exactly what you cannot hand over.

These are the same problem wearing two hats. In both, a server holds a big set, you need the few elements that match a private criterion, and revealing the criterion is the whole risk. That is private selection, and it is strictly harder than PIR's known-index fetch. The two are not identical: finding a neighbor is an ordering question over public values, finding your notes is an ownership question over ciphertexts. Same family, different test. Which is why no single primitive drops cleanly into both, why the same toolbox keeps reappearing, and why our prototype punts on the neighbor problem. Every project building private payments at scale runs into this, and reaches into the same toolbox to deal with it.

## The primitives, and who's building with them

That shared problem, private selection, comes with a small toolbox, and the teams building private payments at scale each reach for a different part of it.

Private Information Retrieval (PIR) reads a known row without revealing which one. That is the part our prototype uses, for the commitment path. Oblivious Message Retrieval (OMR) hands you the messages addressed to you without the server learning which are yours, aimed straight at note discovery. Fuzzy Message Detection (FMD) is the lighter cousin: it flags your notes plus a tunable share of decoys, so you trial-decrypt a smaller, blurred set, and [Penumbra](https://protocol.penumbra.zone/main/crypto/fmd.html) runs it in production.

[Zcash's Tachyon](https://tachyon.z.cash/) takes a different route. Rather than layering PIR or OMR on top of existing keys, it redesigns the key hierarchy entirely: viewing keys are gone, replaced by granular delegation keys. You hand the sync service a bounded, per-note key covering only a specific epoch window, enough for it to derive and scan that note's nullifiers and prove non-spend, without learning the note's value, its commitment, or that two delegated notes belong to the same wallet. The evolving-nullifier idea underneath comes from [Bowe and Miers](https://eprint.iacr.org/2025/2031), the same paper our epoch nullifiers build on, and by keeping the wallet's payment protocol off-chain Tachyon picks up post-quantum privacy almost as a side effect. [Aztec](https://docs.aztec.network/developers/docs/foundational-topics/advanced/storage/note_discovery#advanced-cryptography-techniques) and [Miden](https://docs.miden.xyz/reference/protocol/note#note-discovery) start lighter, with note tags that narrow what a wallet has to fetch, and weigh the heavier options from there.

## Where this leaves us

Four problems stand between a working shielded pool and private payments at Visa scale. Our prototype takes two: epoch nullifiers keep the permanent on-chain record bounded, and private information retrieval lets a wallet read what it needs without narrating it to a provider. Working through both turned up the more interesting result, that the hard parts left over, finding your neighbor in a nullifier tree and finding your notes in the crowd, are the same private-selection problem.

This was a proof-of-concept, built to make that gap concrete. The [specification and code](https://github.com/ethereum/iptf-pocs/tree/master/pocs/private-payment/shielded-pool-extension) are open, the [earlier](/building-private-bonds-on-ethereum/) [posts](/building-private-transfers-on-ethereum/) build the pool it extends, and the IPTF map carries the [use case](https://github.com/ethereum/iptf-map/blob/master/use-cases/private-stablecoins.md) and [approach](https://github.com/ethereum/iptf-map/blob/master/approaches/approach-private-payments.md) for context.

The work is splitting into two fronts that are starting to meet in the middle. Ethereum's roadmap is taking on censorship resistance, gas abstraction, and scaling at the protocol level. Cryptographic research is closing the rest of the gap, everything it takes to make payments fully private at that scale.
