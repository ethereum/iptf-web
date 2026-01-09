---
layout: post
title: "Cypherpunk x Institutional Privacy"
description: "Exploring the overlap and tension between cypherpunks and institutions - and how the Institutional Privacy Task Force is mapping real institutional privacy requirements to solutions on Ethereum."
date: 2026-01-09
author: "Oskar"
hero_image: /assets/images/cypherpunk_institutional_privacy.webp
---

*The following write-up is based on a [talk](https://youtu.be/NkgErrMXuIk?si=vrccSYpwruI1DK3J) given at Cypherpunk Congress, Devconnect in Buenos Aires, November, 2025.*

Today I'm going to talk about cypherpunks and institutional privacy. These are two words you usually don't see in the same sentence, and I thought it'd be interesting to explore both the overlap and tension between them - cypherpunks and institutions are very different groups of people. What is the intersection, if any, between them when it comes to privacy? How should we think about this?

As a brief prelude: when we talk about privacy we mean selective disclosure - having control over who learns what information, when, and under what conditions. By "cypherpunks" we refer to the tradition of using strong cryptography and privacy-preserving technology as tools for social change, emphasizing individual sovereignty in cyberspace.

We divide this write-up into three parts. First, we look at the tension and overlap between these two different animals. Then we'll look at what institutions care about when they talk about privacy. This leads into the work we are doing creating an *Institutional Privacy Map*, exposing what institutions actually need when they talk about privacy - and what solutions are available in the Ethereum ecosystem.

Finally, we'll look at how these different worlds can co-exist on neutral rails. What does this mean in terms of specific patterns you might use, or how you might solve certain use cases? We'll also touch on how you can contribute to this effort.

## Part 1 - Tension & Overlap
It is important that we are honest about the differences between these groups. But we should also not be blind to the fact that there are many similarities between them.

### Some questions
- Do cypherpunks and institutions actually want the same thing when we talk about privacy?
- Where's the overlap vs opposition in terms of culture, social norms, and technology?
- Can both coexist on credibly neutral rails (e.g., Ethereum)?
- What does a plural approach look like?
- Can we onboard institutions onto public blockchains without sacrificing the cypherpunk guarantees that made this all interesting in the first place?

### Why this room, why now
Why are we talking about this at a cypherpunk event?

When we look at public blockchain infrastructure like Ethereum, it aggregates users, tooling, and liquidity - creating massive network effects. Empirically, institutions are exploring privacy on public infrastructure, alongside alternatives like private and consortium L1s.

If we don't shape how institutions are using this technology, we get worse defaults that are hardened elsewhere. This transformation in society will happen either with or without us.

### Why Ethereum?
Why are we talking about Ethereum when it comes to institutional privacy? There are a few reasons. At a basic level, institutions are actively exploring and building on Ethereum. Ethereum provides liquidity, censorship resistance, and acts as a credibly neutral settlement layer. It has continuous uptime for more than 10 years. When we look at stablecoins, RWAs, and DeFi, a large share of activity is on Ethereum and its L2 ecosystem.

The thing to keep in mind here is that we are, trite as it is to say, still early. A single large institution can tip the scale in terms of usage. There is path dependence: the choices institutions make today will impact infrastructure for the next decade (or more). It used to be that regulatory uncertainty was the blocker, but as of 2025, privacy is actually the main blocker for institutional adoption. How can we onboard institutions and solve their privacy problems?

### Privacy for institutions - why
Why do institutions want privacy? Unlike cypherpunks, this is usually not a philosophical or moral question. There are many reasons. When we talk about institutions, we mean financial institutions, governments, and other types of institutions. For simplicity, we'll focus mostly on financial institutions.

One reason financial institutions want privacy is bottom-line impact - whether we are talking about getting the right price for an asset, execution of a trade, or dealing with counterparty risk.

Another big reason is compliance and operational certainty/familiarity. For well-regulated institutions, they have to abide by various privacy regulations - for example, protecting PII. Operationally, most of these institutions are extremely sophisticated. They already have product-market fit. They want to port existing business and legal frameworks onto public infrastructure, and this often requires privacy.

Finally, there's also the question of strategic confidentiality. Institutions want to keep their positions, flows, and intentions private. This is something they take for granted, and not doing so is often a non-starter.

### How institutional privacy differs
How does institutional privacy differ from individual privacy? There are a few different ways. We have multiple actors engaging in something - say, a swap of an asset. These interactions are often N–N, not just 1–1; it isn't just Alice sending some money to Bob. Onboarding a single institution impacts multiple customers, and if these customers trade with each other we get an N–N interaction. This is very different from a single individual shielding their assets.

Another big difference is the high cost of violations. If you are an individual buying a cup of coffee, you might not want your assets linked to this transaction. But in the grand scheme of things, it is usually not top of mind for most people. But if you are a company doing a multi-million dollar transaction, you generally care a lot more about maintaining privacy. Leaking information can have a real measurable impact on your bottom line. Auditability is also often mandatory, due to the regulatory frameworks institutions operate under.

It is important to distinguish privacy from opacity. When we talk about privacy here we are talking about scoped visibility of who learns what, when, and under what conditions.

### Jurisdictions shape behavior (and arbitrage)
One interesting difference between cypherpunks and institutions is that institutions usually exist and operate in some jurisdiction under some regulation. Cypherpunks, on the other hand, often live completely or mostly in cyberspace - a different domain. We can look at the jurisdiction and regulatory framework an institution operates under as a set of additional constraints imposed on them.

Big institutions often operate in multiple jurisdictions, and can engage in various forms of regulatory arbitrage. For example, there are different disclosure rules in different regions, and this leads to different feasible privacy scopes. Jurisdictions such as the US, UK, Switzerland, Singapore, Hong Kong, the Cayman Islands, and the UAE all offer different tradeoffs.

This gets even more interesting when we talk about cross-border flows. Who must verify which claim and where? How does this work in cyberspace on public blockchains like Ethereum?

In general, we expect institutions to keep operating within a legal framework. But we should also expect various forms of arbitrage, where entities pick friendlier venues for some specific business use case. This is already common, where institutions pick and choose based on which legal properties they care more about (friendly regulation, rule of law, common law, flexibility, etc.). In some cases, especially in smaller jurisdictions, institutions are even able to help co-write the policies and laws.

What's key here is making sure the patterns we document hold across these different jurisdictions.

### Not a cage match
It is important to not see this as a cage match between cypherpunks and enterprises. It is not an us-vs-them, no matter what Crypto Twitter would like you to believe.

Cypherpunks value things like self-sovereignty, having no backdoors, and cryptoanarchy. They often treat the nation state as the enemy, or at a minimum are suspicious of it and its intentions. Enterprises value operational privacy, verifiable processes, and predictable operations. While they might have grievances, they often operate within government constraints as a fact of life.

It turns out that a lot of this is based on the same math - just different constraints. There's a minimal shared baseline when it comes to properties like authenticity, privacy, and verifiability.

The differences between what these groups value and the systems they want are real, though, and we should acknowledge them.

### Plurality, briefly
*Plurality* is a powerful concept. A key insight is that multiple legitimate choices can coexist. For example, we can have privacy L1s, private ledgers, and public L1s and L2s. It isn't just a single monopoly.

What is key for our purposes is to keep a public, composable, verifiable option open. Here the crux of the argument is the following:
- Co-existence > Uniformity
- Interoperability > Monoculture

For institutions to build on public infrastructure, the ecosystem must satisfy institutional privacy requirements on public rails like Ethereum. If we don't do this, we end up with closed, surveilled, and insecure rails that impact everyone. We want to ensure we still have a system that is permissionless - and we have the ability to move money in and out of it.

So what exactly are those institutional privacy requirements? This leads us into the Institutional Privacy Map.

## Part 2 - The Institutional Privacy Map
What we want to do is turn the demand that we see into something more structured and reusable. But first, a little bit more about the IPTF.

### IPTF - who we are
The Institutional Privacy Task Force (IPTF) is a team at the Ethereum Foundation, co-led by Mo and Oskar, that is helping institutions build on top of Ethereum. It is a small, focused team with business leads, technical architects, and researchers. It is a new team, having only been around for about two months (note: at the time of the recording; about four months at the time of this write-up). We run workshops, deep-dives, and collaborative drafts with institutions and vendors.

Why is neutral guidance important? One thing we have noticed is that a lot of institutions get approached by various well-funded projects with very strong business development functions. The claims they put forth may or may not reflect reality, but it is often difficult for institutions to tell what is true.

What IPTF does is try to surface truths and demystify the space. The ultimate goal is to provide privacy that is performant, secure, usable, and accessible - specifically focused on institutions.

### How we work
We start from real-world validated use cases and constraints. These are things big institutions tell us directly. The constraints might be related to business, legal, or operational requirements. After that we try to distill patterns, reusable building blocks, and approaches (end-to-end compositions). Finally, we deliver privacy specifications, guidance playbooks, and validation PoCs. We keep a public reference that's open source, and leave sensitive engagement details private. This is to make sure institutions feel comfortable sharing the specific constraints they operate under. We anonymize a lot of these requirements, and our goal is to open source as much as possible.

### The Institutional Privacy Map
What does the institutional privacy map look like? It is an open-source GitHub repository. We frame the problem, showing where leakage occurs. Then we route this to specific solutions (patterns → approaches → vendor options). In terms of methodology, we start with validated use cases (from big institutions). We identify a specific set of requirements. These could be related to TPS, privacy scope, how the system should be composed, or regulatory constraints.

The goal is to provide playbooks and guidance, ultimately helping institutions make better decisions. We also want to surface areas where more work is needed. It is very much a work in progress, both in breadth and depth; feedback is welcome.

### The Map: structure
How is the map structured? We have the following categories:
- Use Cases: business problems & requirements
- Patterns: reusable technical building blocks and specs
- Approaches: composed end-to-end solutions (patterns + implementation options)
- Jurisdictions: regulatory frameworks & compliance
- Domains: payments, custody, trading, etc.
- Vendors: neutral tooling documentation

Regarding jurisdictions: we aren't legal experts, but it is useful to have a TL;DR of various regulations. For example: how does the GENIUS Act impact stablecoin design?

![The map: structure on GitHub](/assets/images/iptf-map-github.png)

### The Map: how to navigate
Depending on what type of user you are, you might navigate the map differently. We have identified three primary personas: business, technical, and legal/compliance. These reflect different levels of expertise as well as concern.

If you are on the business or product side, you might start with use cases, look at relevant jurisdictions, and then see what approaches there are. If you are on the technical side (engineering or research), you might start with patterns, see how they make up approaches, and finally evaluate vendor options. If you are on the legal side (compliance), you might start with jurisdictions and make sure it accurately captures your understanding, then look at use case requirements, and finally disclosure mechanisms.

### Where leakage happens
We can look at leakage in a few different ways. Pre-trade, we often see intents or order flow being exposed. For settlement, there's a risk of linking transactions, as well as principal risk (DvP and PvP). DvP stands for Delivery-vs-Payment, where we want to make sure the delivery of an asset happens at the same time as the payment does. It has to be atomic: either they both happen or neither does. This is often a legal requirement, and it isn't just captured in a smart contract.

Often these transactions happen across different networks - for example via a separate clearing house. This is a stricter requirement than most cross-chain bridges operate under, and it helps minimize counterparty risk. PvP is the same idea, but for Payment-vs-Payment.

For post-trade, we don't want positions and notes to be visible, but we still want them to be auditable. In general, we can look at the lifecycle of any transaction, plug holes for leakage, while still being verifiable and compliant.

### Current status
Where are we at right now? We have a handful of documented use cases (and similarly for approaches). We are careful to only include validated use cases that multiple institutions have told us directly about. This means we aren't just documenting some wishlist, but actual demand from some of the biggest institutions in the world.

For patterns, we've got decent coverage of basics, but this needs to be expanded. Vendor docs exist largely thanks to community contributions. We already have outside contributors, but this definitely has room to grow together with the ecosystem. We want to make sure the scope stays neutral, where we show different options and are open about trade-offs and maturity. We welcome feedback and contributions on all of this.

## Part 3 - Co-existence on neutral rails
How can cypherpunks and institutions co-exist on the same neutral infrastructure? As a cypherpunk, you might think compliance tech is a direct threat. It is important, however, to be able to keep two contradictory models in your mind at the same time. It is possible to accommodate both, assuming the base layer is sound. This is the plural way.

### From patterns to solutions
Patterns are reusable building blocks - for example: how to do commitments, atomic DvP, or scoped viewing. Patterns can be specifications, ERCs, or ways to get certain privacy guarantees. Patterns are often universal across cypherpunk and institutional use cases. Where it gets interesting is how we compose them, which leads us into approaches. Approaches are how we compose patterns for specific use cases.

We'll look at a few topics as case studies and give a very high-level overview. The topics we'll cover are: Private Broadcasting, Private Bonds (issuance/trading), Private Payments, and Private Trade Settlement.

You can think of patterns as little Lego bricks. Approaches are just: which bricks do we snap together for this concrete use case?

### Approach: Private Transaction Broadcasting
The goal of private transaction broadcasting is to reduce pre-trade leakage. This means things like front-running, MEV, and leaking strategy. The way we do it is with encrypted/private transaction lanes or OTC submission. We can also optionally do private rollup execution. Why does this matter? We get better execution quality while preserving composability - for example with DeFi.

### Approach: Private Bonds (issuance/trading)
The problem of private bonds - both issuance and trading - is that we want confidential bond deals with assured and quick settlement. Having fast settlement is crucial in terms of opening up massive monetary flows and freeing up capital. To do this we compose different patterns: shielded transfer, atomic DvP, and selective disclosure. The outcome is compliant confidentiality and deterministic finality.

### Approach: Private Payments
The goal of private payments is to get stakeholder-only visibility, while still enabling regulator and auditor access when required. The way we do this is through shielded balances/transfers, scoped view, and optionally PvP/DvP for FX legs. Private payments matter because you get operational privacy without black-box accounting.

This might seem like a "simple" problem, but payment infrastructure is surprisingly complex. For example, there are often treasury custodians involved, and payments often happen across different networks. There are usually more than two stakeholders involved. Payments for institutions and retail customers also look quite different: a closed set of 100 banks doing average transactions of millions of dollars vs millions of users doing average transactions of $100. This impacts design choices and constraints.

### Approach: Private Trade Settlement
The goal of private trade settlement is to minimize linkage between transactions and reduce operations friction. It applies to things like bonds, RWA tokenization, derivatives, etc. We can get it by doing things like batching proofs/commitments, using a neutral settlement venue, and having auditable logs.

Having a neutral settlement venue is important for risk management, and the choice isn't always obvious. It matters in terms of having more predictable cycles and cleaner reconciliation, which impacts liquidity. Finally, we also want to be able to integrate with custodians, etc.

### The Map as a decision path
We can look at the privacy map as a decision path. We start by identifying what use case we are trying to solve: what is the actual business problem? After that we apply jurisdictional constraints, understanding what regulation we are operating under. Once we have clarity on that, we can start to select patterns and approaches, understanding what building blocks to use and how to combine them. Finally, we can evaluate vendors, understanding what tools exist in the ecosystem and what their performance is like.

Based on all of the above, we can run pilots, learn from them, and improve collectively. Ideally we create a strong feedback loop where learnings are put back into the privacy map (PRs/issues welcome).

Most of these decision paths are incomplete, and that's why we need you, dear community member. The point is that if you are a bank, an exchange, or a protocol dev, you shouldn't have to start from a blank page. This gives you a guide - a path - to go from a specific business problem you have, all the way to running a pilot.

### Where we're headed
We need broader coverage across different domains. We also want deeper patterns and playbooks for specific approaches. Ultimately, the goal is to create shared playbooks and best practices for Ethereum privacy.

## Summary

### Cypherpunk x Institutions
Cypherpunks and institutions have different goals, but shared math. Different systems can coexist on the same credibly neutral foundation. Keeping a public, composable, verifiable option open matters for everyone. And finally: we need cypherpunks in the room when these specs are written.

### Institutional Privacy
Institutions want privacy on Ethereum. We're building an open, shared privacy map of the space. You can contribute - PRs/issues, or come talk with us.

## Join us

### Resources
- GitHub: [ethereum/iptf-map](https://github.com/ethereum/iptf-map)
- Web: [iptf.ethereum.org](https://iptf.ethereum.org/)
- X: [@iptf_updates](https://twitter.com/iptf_updates)

You can contribute patterns, approaches, and vendor notes. Also feel free to come talk with us - bring real constraints and feedback.

**We need cypherpunks in the room when these specs are written.**
