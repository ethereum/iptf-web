---
layout: default
title: "Institutional Privacy Task Force (IPTF)"
---

<section class="hero">
  <span class="hero-badge">An Ethereum Foundation initiative</span>
  <h1>Institutional Privacy Task Force</h1>
  <p class="hero-tagline">Advancing privacy standards for enterprise-grade Ethereum applications</p>
</section>

<section class="about">
  <p>The Institutional Privacy Task Force (IPTF) is a dedicated team that helps onboard institutions and enterprises onto Ethereum, with a focus on ensuring their privacy needs are met in a performant, secure, usable, and accessible way.</p>
  <p>We document patterns, use cases, and regulatory frameworks for implementing privacy-preserving financial applications on Ethereum.</p>
</section>

<section class="initiatives">
  <h2>Current initiatives</h2>
  <div class="initiative-grid">
    <a href="https://github.com/ethereum/iptf-map" class="initiative-card" target="_blank">
      <span class="initiative-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
      </span>
      <h3>Ethereum Privacy Map</h3>
      <p>Mapping institutional use cases and privacy requirements</p>
    </a>
    <div class="initiative-card">
      <span class="initiative-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </span>
      <h3>Multi-stakeholder Coordination</h3>
      <p>Bridging vendors/protocols, institutions, and regulators</p>
    </div>
    <a href="https://github.com/ethereum/iptf-pocs" class="initiative-card" target="_blank">
      <span class="initiative-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </span>
      <h3>Proof of Concepts</h3>
      <p>Hands-on implementations and educational resources</p>
    </a>
  </div>
</section>

<section class="latest-posts">
  <h2>Latest writeups</h2>
  <div class="featured-posts">
    {% for post in site.posts limit:2 %}
    {% unless post.published == false %}
    <a href="{{ post.url | relative_url }}" class="featured-post-card">
      {% if post.hero_image %}
      <div class="featured-post-image">
        <img src="{{ post.hero_image | relative_url }}" alt="" loading="lazy">
      </div>
      {% endif %}
      <div class="featured-post-content">
        <h3>{{ post.title | escape }}</h3>
        <p class="featured-post-meta">{{ post.date | date: "%b %d, %Y" }}{% if post.author %} · {{ post.author }}{% endif %}</p>
        {% if post.description %}
        <p class="featured-post-desc">{{ post.description | truncatewords: 20 }}</p>
        {% endif %}
      </div>
    </a>
    {% endunless %}
    {% endfor %}
  </div>
  <a href="/blog/" class="see-all-link">See all articles →</a>
</section>

<section class="contact">
  <h2>Get in touch</h2>
  <div class="contact-links">
    <a href="mailto:iptf@ethereum.org" class="contact-item">
      <span class="contact-label">Email</span>
      <span class="contact-value">iptf@ethereum.org</span>
    </a>
    <a href="https://forms.gle/6Za8suF5QHyRamcW7" target="_blank" class="contact-item">
      <span class="contact-label">Institutions</span>
      <span class="contact-value">Contact form →</span>
    </a>
    <a href="https://forms.gle/znifD8h9Uw6VEX6Q9" target="_blank" class="contact-item">
      <span class="contact-label">Vendors</span>
      <span class="contact-value">Contact form →</span>
    </a>
  </div>
</section>
