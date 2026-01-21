---
layout: page
title: "Institutional Privacy Task Force (IPTF)"
---

> Advancing privacy standards for enterprise-grade Ethereum applications

## About

The Institutional Privacy Task Force (IPTF) is a dedicated team that helps onboard institutions and enterprises onto Ethereum, with a focus on ensuring their privacy needs are met in a performant, secure, usable, and accessible way.

This repository serves as the central knowledge base for IPTF, documenting patterns, use cases, and regulatory frameworks for implementing privacy-preserving financial applications on Ethereum.

## Current initiatives

- **Ethereum Privacy Map** - Mapping institutional use cases and privacy requirements
- **Multi-stakeholder Coordination** - Bridging vendors/protocols, institutions, and regulators

## Latest writeups

{% for post in site.posts limit:3 %}{% unless post.published == false %}- [{{ post.title | escape }}]({{ post.url | relative_url }}) {{ post.date | date: "%b, %Y" }}
{% endunless %}{% endfor %}
[See all →](/blog/)

## Get in touch

- 📧 [iptf@ethereum.org](mailto:iptf@ethereum.org)
- <a href="https://forms.gle/6Za8suF5QHyRamcW7" target="_blank">Institutions contact form</a>
- <a href="https://forms.gle/znifD8h9Uw6VEX6Q9" target="_blank">Vendors contact form</a>
