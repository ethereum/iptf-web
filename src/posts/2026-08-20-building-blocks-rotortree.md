---
layout: post
title: "Building blocks: rotortree"
description: "A durable append-only Merkle tree for note commitments. Builds the entire Tornado Cash tree in 19 milliseconds, 450x faster than the TypeScript library this ecosystem runs."
date: 2026-08-20 15:00:00 +0200
author: "Aaryamann"
image: ../assets/posts/2026-08-20-building-blocks-rotortree/hero.png
published: true
tags:
  - building-blocks
  - merkle-tree
  - performance
  - open-source
---

*First in "Building blocks", a series on the primitives that confidential systems on Ethereum keep needing. The blocks live in [ethsystems/works](https://github.com/ethsystems/works). This post is about the first of them.*

Every shielded pool we have worked on has had one structure in common. Value lives in notes, each note gets hashed into an append-only Merkle tree, and spending a note means proving the note exists in the tree. [Private transfers](/writeups/building-private-transfers-on-ethereum-with-shielded-pools/) needed one, [hardened shielded pools](/writeups/exploring-hardened-shielded-pools/) went after how fast it grows, and [in-pool compliance](/writeups/building-compliant-shielded-pools-on-ethereum/) pushed attestations and per-account policy state into the same structure.

Each time we reused an existing library and shipped the proof of concept. Benchmarking them turned up optimizations we had left on the table, so we are reimplementing the primitives we keep reaching for and maintaining them in the open. `rotortree` is the first.

Every deposit ever made into the largest Tornado Cash pool is 90,435 note commitments, accumulated over 6.7 years. `rotortree` builds that tree, durably on disk, in **19 milliseconds**. The TypeScript library much of this ecosystem runs takes 8.58 seconds for the same count. At the top of the ladder, 748 million commitments, roughly one day of India's retail payment volume, take 82 seconds. The rest of this post is where those numbers come from and what they cost.

## What it is

An append-only Merkle tree for note commitments. It implements [leanIMT](https://zkkit.org/leanimt-paper.pdf), an incremental Merkle tree optimization, with one difference: how many children a node has is yours to pick.

The incremental Merkle tree is the data structure. Leaves land at the next free position, and every ancestor on the path is rehashed. A commitment tree is the role that structure plays inside a shielded pool: leaves are note commitments, nothing is ever deleted or rewritten in place, and membership is proved inside a circuit. A classic incremental Merkle tree pads to a fixed depth with zero leaves and pays to hash them. The leanIMT does not perform the hashing of the padded depth, by simply lifting the leaves into higher levels where necessary.

A Merkle proof is the path from a leaf to the root plus the siblings along that path. Walking the path costs one hash per level. That is the question the crate is built around: can we cut the number of levels, and cut the hashes with them? Keeping the leaf count fixed, the way to do that is to widen the tree, i.e., to give every node more children.

![Three trees over 748 million leaves. At two children per node the tree is 30 levels deep, at four children 15 levels, and at eight children 10 levels. An inclusion proof costs one hash per level, so the proof walks 30, 15 or 10 hashes for the same set of commitments.](../assets/posts/2026-08-20-building-blocks-rotortree/arity_depth.svg)

*Figure 1: 748 million leaves, at three widths. Depth is the base-N logarithm of the leaf count: 30 levels at width 2, 15 at width 4, 10 at width 8.*

However, widening is not free. Each level now costs a hash over four inputs rather than two, and whether the shorter path pays for the fatter node comes down to the selection of the hash function. Unfortunately, [Poseidon](https://eprint.iacr.org/2019/458) scales with the number of inputs. [BLAKE3](https://github.com/BLAKE3-team/BLAKE3), on the other hand, absorbs 128 bytes for close to what it charges for 64, which is where this optimization becomes more lucrative.

## The interface

Branching factor and maximum depth are compile time const-generic parameters.

```rust
use rotortree::{Blake3Hasher, LeanIMT};

// arity = 4, maximum depth = 20, hash = blake3
let mut tree = LeanIMT::<Blake3Hasher, 4, 20>::new(Blake3Hasher);
let root = tree.insert_many(&commitments)?;

// Proofs are generated from a snapshot
let snapshot = tree.snapshot();
let proof = snapshot.generate_proof(0)?;
assert!(proof.verify(&Blake3Hasher)?);
```

## A durable tree

A tree that lives only in memory has to be rebuilt from the chain every time the process restarts. `rotortree` writes as it goes instead. An insert reaches a write-ahead log before it is acknowledged. SQLite and PostgreSQL take the same route for the same reason. Appending to a sequential log and syncing that is much cheaper than updating the structure in place, and the log alone is enough to rebuild the structure after a crash. A checkpoint compresses the log into the data files and truncates it, for disk efficiency.

![The write path. An insert appends an entry to the write-ahead log and updates the in-memory levels, and the caller receives a root and a durability token. A background thread fsyncs the log on an interval and releases the tokens for every entry it covers. A checkpoint materializes committed chunks into data files and truncates the log, after which cold levels are read back through memory maps rather than held in memory. Recovery replays the log on top of the last checkpoint.](../assets/posts/2026-08-20-building-blocks-rotortree/write_path.svg)

*Figure 2: Inserts are acknowledged before the fsync, and the checkpointing interval is up to the caller.*

```rust
use std::time::Duration;
use rotortree::{
    Blake3Hasher, CheckpointPolicy, FlushPolicy, RotorTree, RotorTreeConfig, TieringConfig,
};

let tree = RotorTree::<Blake3Hasher, 4, 20>::open(Blake3Hasher, RotorTreeConfig {
    path: "/var/lib/pool/commitments".into(),
    flush_policy: FlushPolicy::Interval(Duration::from_millis(10)),
    checkpoint_policy: CheckpointPolicy::EveryNEntries(1 << 20),
    tiering: TieringConfig::default(),
    verify_checkpoint: true, // recompute the root on recovery
})?;

let (root, token) = tree.insert_many(&commitments)?;
token.wait(); // returns once the entries are fsynced
```

Insertion returns a root and a durability token rather than blocking on the disk. A pool that follows Ethereum as its source of truth can insert a whole block's commitments and wait once, at the block boundary. The benchmarks below wait till the checkpoint is completed and on disk.

`FlushPolicy` decides when the log is synced and `CheckpointPolicy` decides when it is folded away. `TieringConfig` decides how much of the tree stays resident. After a checkpoint, levels below `pin_above_level` are read through memory maps rather than held on the heap. This keeps the memory footprint small, while being configurable.

## The workload

Four things vary across these libraries at once: the hash function, the branching factor, the number of cores working, and whether anything reaches disk. We benchmarked different variations to show the performance characteristics accurately.

`rotortree`, [`zk-kit-lean-imt`](https://crates.io/crates/zk-kit-lean-imt) in Rust and [`@zk-kit/lean-imt`](https://www.npmjs.com/package/@zk-kit/lean-imt) in TypeScript all run circom-compatible Poseidon over [BN254](https://eips.ethereum.org/EIPS/eip-197), binary, single-threaded, in memory.

The real workload is every deposit ever made into the [Tornado Cash 1 ETH pool](https://etherscan.io/address/0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936), 90,435 commitments read from mainnet at a pinned block. Pulling the logs out of an RPC endpoint is generally the bottleneck here. Cached logs or snapshots solve that up to a certain degree.

We also ran several synthetic benchmarks that are included in the table below.

Every number below comes from an M4 Pro with 14 cores and 48 GB of memory.

## The control

Building the entire Tornado pool, first deposit to last, then sampling 1,000 inclusion proofs spread across the leaf range:

| | build | proof gen | proof verify |
|---|---|---|---|
| `@zk-kit/lean-imt`, TypeScript | 8.58 s | 12.6 µs | 1.55 ms |
| `zk-kit-lean-imt`, Rust | 1.55 s | 387 ns | 277 µs |
| `rotortree`, same Poseidon, 1 core | 1.46 s | 306 ns | 268 µs |
| `rotortree`, same Poseidon, 14 cores | 0.19 s | 321 ns | 272 µs |
| `rotortree`, BLAKE3 at width 4, durable | 0.019 s | 399 ns | 955 ns |

Note that the tree machinery is not where the speed comes from. Pinned to the same hash, the same width and one core, `rotortree` lands a few percent ahead of zk-kit's Rust implementation, which is what two careful implementations of one algorithm should do.

## Where the speed comes from

One change per row, all at 10 million leaves:

| | leaves/sec | proof gen | proof verify |
|---|---|---|---|
| `zk-kit-lean-imt`, Poseidon, 1 core | 59,256 | 4,050 ns | 393 µs |
| `rotortree`, Poseidon, 1 core | 60,220 | 1,796 ns | 396 µs |
| `rotortree`, Poseidon, 14 cores | 589,627 | 2,122 ns | 403 µs |
| `rotortree`, BLAKE3 at width 4 | 18,046,003 | 1,541 ns | 1.3 µs |
| `rotortree`, BLAKE3 at width 4, durable | 12,547,984 | 716 ns | 1.3 µs |

leanIMT is embarrassingly parallel, since every parent at a level depends only on its own children. With the `parallel` feature `rotortree` runs about 10x the single-threaded rate. Swapping Poseidon for BLAKE3 and widening to four children buys another 31x on top of that. Turning durability on hands about 30% of the throughput back, in exchange for a tree that survives the process that built it.

A width-4 tree over 10 million leaves is 12 levels instead of 24, and since BLAKE3 is a far cheaper hash, verifying an inclusion proof drops from 393 µs to 1.3 µs.

## What that buys

19 milliseconds, durably, for the entire history of the largest Tornado instance. It's fast enough that a tree can be reindexed on demand.

The more interesting question is what happens at a volume somebody outside this industry would recognize. [UPI](https://www.npci.org.in/what-we-do/upi/product-statistics) cleared 23.2 billion transactions in May 2026, a little under 750 million a day, which is about 8,700 a second averaged out. Visa lands in the same order rather than a different one, at [257.5 billion processed transactions](https://www.sec.gov/Archives/edgar/data/1403161/000140316125000089/v-20250930.htm) in fiscal 2025, or roughly 8,200 a second.

Put those next to the tree:

| workload | leaves | accumulated over | `rotortree`, durable | 
|---|---|---|---|
| Tornado Cash 1 ETH pool, every deposit ever | 90,435 | 6.7 years | 0.019 s | 
| One Visa day, fiscal 2025 average | 706,000,000 | 24 hours | 77.6 s | 
| One UPI day, May 2026 average | 748,000,000 | 24 hours | 82.2 s | 

A day of the largest card network on earth arrives over 24 hours and goes into a durable commitment tree in 78 seconds, or about a thousandth of the time it took to show up.

Purely in memory, ingesting 748 million leaves takes about 41.4 seconds and 31.4 GB of resident memory. The durable configuration is slower and holds a quarter of the memory, because it tiers cold levels out to mapped files while the in-memory one keeps all of it.

Proof generation does degrade up there, to 181 µs, since one proof touches pages scattered across the whole structure. Verification barely moves, 1.3 µs to 1.6 µs, because it only ever walks one path.

## What it does not fix

This crate does not address the issue that limits a long-lived pool, which is that storage grows forever. A faster tree does not help there. The answer is [a new tree per generation](/writeups/exploring-hardened-shielded-pools/) with the generation encoded into what you insert, which is the direction [hardened shielded pools](/writeups/exploring-hardened-shielded-pools/) took.

`rotortree` also has not been audited. It carries differential tests against zk-kit, property tests, and a recovery suite that kills the process mid-batch.

`rotortree` is [on crates.io](https://crates.io/crates/rotortree) and lives in [ethsystems/works](https://github.com/ethsystems/works), under MIT or Apache-2.0. The ladder in this post asks one narrow question, and the crate carries a [much fuller benchmark suite](https://github.com/ethsystems/works/tree/main/crates/rotortree/benches) covering the operations it skips: WAL fsync, recovery and replay, sustained checkpointing, contention between concurrent writers, and node widths from 2 up to 16.

More building blocks soon.
