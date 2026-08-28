---
title: "Introducing EthSystems"
description: "EthSystems builds confidential systems for institutional Ethereum, carrying forward the IPTF work as an independent company focused on privacy, protocol design, and commercial execution."
date: "2026-07-14"
author: "Oskar"
image: ../assets/posts/2026-07-14-introducing-ethsystems/hero.png
published: false
---

Welcome to EthSystems. **We build confidential systems for institutional Ethereum.**

What does that mean? Since its inception in 2014, Ethereum has slowly been turning into the Schelling point for any infrastructure where there's desire for a shared, public, immutable ledger that no one controls. In the last few years, this is increasingly true for institutions. But the fight isn't over. There are many different futures on the horizon, and our actions today will define the defaults for decades to come.

Public blockchains like Ethereum have a clear edge over private ledgers, as argued in this [post](https://ethsystems.org/writeups/public-rails-vs-private-ledgers/). One of the bigger problems with public blockchains is the lack of built-in, modular privacy tools. Essentially: while relying on a globally shared, verifiable ledger, who has access to what information? Under what conditions? With what security, performance and usability properties? Having worked in the crypto privacy space for over a decade, we believe there'll be many different solutions, all with their own trade-offs. There's no silver bullet.

### Institutional demand

What do we mean by institutions? In the broadest sense possible, an institution is any structure of rules and norms, created by humans, that has some form of continuity. This includes anything from economic and legal systems, to businesses, governments, and civic organizations. All of these can benefit from technologies like Ethereum, especially when combined with privacy tech.

From a market point of view, there's massive demand especially when it comes to financial institutions: stablecoins, tokenization, settlement. This is especially true with increased regulatory clarity in recent years. Wall Street et al have found crypto as an asset class, but not yet as a commercial infrastructure. This is changing. We are witnessing the global financial infrastructure upgrading in real time, a once-in-a-generation event.

With this comes a need for technical rigor. We are past the YOLO phase of crypto. These institutions have real businesses with billions of dollars on the line. They need to know the systems they rely on are secure and designed properly. This means ensuring proper protocol design and architecture, with clear security and privacy properties. This is especially important when working with immutable and publicly shared ledgers like Ethereum.

### Our team

EthSystems is Mo Jalil, Oskar Thorén, and Aaryamann Challani.

Our team has an extensive background in protocol research and design, especially when it comes to how to design confidential systems. Back in 2017, before privacy in crypto was cool, we were designing secure messaging, p2p and infrastructure privacy protocols. The kind that other privacy products run on. We've been running production crypto infrastructure ever since, from before "privacy" was even a narrative. We also have a background in enterprise technology and traditional finance, and several of us are repeat founders.

For the past year, we've been working at the Ethereum Foundation (EF) as the Institutional Privacy Task Force (IPTF). As part of this we've been able to do two things at the same time:

1. Talk to hundreds of institutions, including many of the biggest ones in the world
2. Ship technical work to help institutions onboard onto Ethereum, especially related to privacy

Before IPTF, some of us had been at or around EF for several years, including setting up the APAC Enterprise team and advising on privacy, the access layer and institutional strategy. This is in addition to working in the Ethereum space for close to a decade. Working at the EF was a great privilege and a responsibility, and it opened a lot of doors. We are leaving on good terms with everyone and will continue collaborating with friends and colleagues.

As EF continues doubling down on cypherpunk fundamentals, especially with a focus on individuals, there's room for an independent for-profit entity that can make different choices in the trade-off space. The fundamental properties that make this technology interesting: Censorship Resistance, Open Source, Privacy, and Security (CROPS) are relevant for both individuals and institutions. We've written more about the tension and overlap between cypherpunk and institutional privacy [here](https://ethsystems.org/writeups/cypherpunk-x-institutional-privacy/) (note this was written before EF's recent Mandate). Our attitude here is best summarized as being pluralist: pragmatic *and* principled.

As for the other spin-outs, we see ourselves as complementary: our niche is depth over breadth, with a focus on technical execution.

### Proof of work

While conversations we've had and have with institutions are confidential, the technical work is open source. We have built up a body of work over the last year, and will continue to ship publicly as EthSystems. Open source, protocol specifications, privacy and working with the larger Ethereum ecosystem are a core part of our DNA. Here's a sample of the things we've been doing:

- [Ethereum Privacy Map](https://github.com/ethsystems/map) mapping real-world institutional privacy requirements across the Ethereum ecosystem with [use cases](https://ethsystems.org/use-cases/), [patterns](https://ethsystems.org/patterns/), [approaches](https://ethsystems.org/approaches/), [vendors](https://ethsystems.org/vendors/), [jurisdictions](https://ethsystems.org/jurisdictions/), and an [interactive map graph](https://ethsystems.org/map/).
- Private bonds PoCs: a three-part build exploring [zero-knowledge proofs](https://ethsystems.org/writeups/building-private-bonds-on-ethereum/), [privacy L2s](https://ethsystems.org/writeups/building-private-bonds-on-ethereum-part-2/), and [fully homomorphic encryption](https://ethsystems.org/writeups/building-private-bonds-on-ethereum-part-3/) for confidential institutional bonds.
- Private stablecoin transfer PoCs: [compliance-first shielded pools on L1](https://ethsystems.org/writeups/building-private-transfers-on-ethereum-with-shielded-pools/) with KYC-gated entry and selective disclosure, plus [ZK-plasma designs](https://ethsystems.org/writeups/building-private-transfers-on-ethereum-with-plasma/) for scale.
- Private cross-chain atomic swap PoC: [part 1](https://ethsystems.org/writeups/private-crosschain-atomic-swaps-part-1-of-2/) and [part 2](https://ethsystems.org/writeups/private-crosschain-atomic-swaps-part-2-of-2/) cover delivery-versus-payment across chains.
- [DIY Validium PoC](https://ethsystems.org/writeups/diy-validium-private-logic-on-public-rails/): ordinary business logic, proved with ZKPs, verified on Ethereum.
- Resilience PoCs: three-part series on [plural identity](https://ethsystems.org/writeups/resilient-plural-identity/), [disbursement rails](https://ethsystems.org/writeups/resilient-disbursement-rails/), and [civic participation](https://ethsystems.org/writeups/resilient-civic-participation/) under issuer failure, adversarial jurisdictions, and private coordination constraints.
- [Hardened shielded pools PoC with specs](https://ethsystems.org/writeups/exploring-hardened-shielded-pools/): extends shielded pools with epoch nullifiers and PIR-backed note discovery.
- General write-ups: [Cypherpunk x Institutional Privacy](https://ethsystems.org/writeups/cypherpunk-x-institutional-privacy/) explores overlap and tension between cypherpunks and institutions when it comes to privacy; [Public Rails vs Private Ledgers](https://ethsystems.org/writeups/public-rails-vs-private-ledgers/) compares cryptographic privacy on public chains with trust-based privacy on private ledgers.

All PoCs are open source and have rigorous protocol specifications with security properties. This is in addition to countless private workshops, architecture reviews and reports.

### A for-profit company

EthSystems is a for-profit company. While we love public goods, we believe there's a real need for a credible commercial entity that focuses on the hard technical problems required for institutional adoption.

The business model is simple: bespoke consulting, focused on solving the hardest blockers for institutional adoption. In practice, this means continuing a lot of the work we have been doing, only charging money for it. Commercial engagements often require a commercial counterparty. We are funded and backed by long-term Ethereum-aligned investors. This is a decade-long transition, and we aren't going anywhere.

Examples of commercial activities:
- Workshops to turn vague interest into hard requirements
- Proof of concepts around real institutional friction points: payments, tokenized assets, selective disclosure, private settlement
- Architecture reviews and protocol specifications, formalizing security properties
- Production systems that integrate with vendors and infrastructure institutions already run

In addition to this we will continue doing public good work such as open source libraries, protocol specifications, mapping the ecosystem, write-ups, and community engagement.

This acts as a feedback loop between traditional institutions with real demand and the Ethereum community with protocols and products: Institutions rarely know how to ask for Ethereum-native systems, and Ethereum teams rarely understand how institutional procurement, compliance, and risk work. We sit in the middle and translate both ways.

### How to work with us

If you represent an institution that wants to build on Ethereum and you think we can be useful, please contact us [here](https://docs.google.com/forms/d/e/1FAIpQLSd_89XMoNNUbqzJOZFsFsf1ibk2BK4vb5KV1SLre5naNdt6IA/viewform).

We are also hiring. Specifically, BD people, protocol research engineers and operations. See [join us](/join/) for more detail. You can also follow us on X [here](https://x.com/eth_systems).

Many institutions in the future will run on Ethereum. One of the biggest challenges is how to make these systems confidential, and there won't be a single solution that fits all. We've got a lot of work ahead of us. Come join us if this future is exciting to you, either as a contributor or as a customer.
