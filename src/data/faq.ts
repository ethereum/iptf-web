export interface FaqLink {
  label: string;
  href: string;
}

export interface FaqEntry {
  q: string;
  a: string[];
  links?: FaqLink[];
}

export interface FaqCategory {
  label: string;
  questions: FaqEntry[];
}

export const faqCategories: FaqCategory[] = [
  {
    label: 'Privacy basics',
    questions: [
      {
        q: 'Is Ethereum private enough for institutional use?',
        a: [
          'Not by default. Ethereum is a public, transparent ledger — every transaction, balance, and counterparty relationship is visible to anyone. For institutional use, this is a non-starter: treasury operations leak competitive intelligence, counterparty exposure becomes public, and regulatory obligations around data minimization are impossible to meet.',
          'However, a growing ecosystem of privacy-preserving layers can be composed on top of Ethereum: shielded pools, privacy L2s, zero-knowledge proofs, and trusted execution environments. The question is not whether Ethereum is private, but which privacy architecture fits your requirements and what trade-offs you are accepting.',
        ],
        links: [
          { label: 'Private Payments', href: '/approaches/approach-private-payments/' },
          { label: 'Shielded ERC-20 Transfers', href: '/patterns/pattern-shielding/' },
          { label: 'Private L2s', href: '/patterns/pattern-privacy-l2s/' },
        ],
      },
      {
        q: 'What does "private" actually mean on a public blockchain?',
        a: [
          'Privacy on Ethereum means controlling what information is visible and to whom. The spectrum ranges from anonymity (unlinkable addresses, but amounts may be visible) to full confidentiality (amounts, counterparties, and transaction patterns all hidden). Most institutional solutions sit somewhere in between, using selective disclosure to reveal specific data to authorized parties like regulators.',
          'The IPTF uses the I2I/I2U distinction to clarify threat models: in institution-to-institution contexts, both parties have symmetric trust and shared compliance burden. In institution-to-user contexts, the power dynamic is asymmetric and privacy protections must favor the weaker party.',
        ],
        links: [
          { label: 'Regulatory disclosure', href: '/patterns/pattern-regulatory-disclosure-keys-proofs/' },
          { label: 'Viewing keys', href: '/patterns/pattern-user-controlled-viewing-keys/' },
        ],
      },
    ],
  },
  {
    label: 'Compliance & regulation',
    questions: [
      {
        q: 'What does MiCA say about on-chain privacy?',
        a: [
          'MiCA does not prohibit on-chain privacy, but it imposes obligations that any privacy architecture must accommodate: KYC/AML for crypto-asset service providers, Travel Rule compliance for transfers, and record-keeping requirements. The key question is whether your privacy solution supports selective disclosure — the ability to reveal specific transaction data to regulators without making it publicly visible.',
          'Viewing keys and zero-knowledge proofs of compliance (proving you hold a valid KYC attestation without revealing your identity) are the primary mechanisms. The regulatory posture is: privacy is acceptable as long as compliance access exists.',
        ],
        links: [
          { label: 'EU / MiCA', href: '/jurisdictions/eu-MiCA/' },
          { label: 'Regulatory disclosure', href: '/patterns/pattern-regulatory-disclosure-keys-proofs/' },
        ],
      },
      {
        q: 'Can institutions use DeFi and stay compliant?',
        a: [
          'It depends on the DeFi protocol and the jurisdiction. The core tension is that DeFi composability often requires public state, while institutional compliance requires controlled access. Permissioned DeFi pools (where participants are KYC\'d before entry) and privacy layers with attestation-gated access are the two main patterns that reconcile these requirements.',
          'Shielded pools with attestation-gated entry can provide DeFi-like composability while maintaining a compliance perimeter. Our approaches on private payments and private trade settlement demonstrate this end-to-end.',
        ],
        links: [
          { label: 'Private Payments', href: '/approaches/approach-private-payments/' },
          { label: 'Verifiable attestation', href: '/patterns/pattern-verifiable-attestation/' },
        ],
      },
      {
        q: 'How do we handle Travel Rule obligations with private transfers?',
        a: [
          'The Travel Rule requires originator and beneficiary information to accompany transfers above a threshold. In a shielded transfer, this information is hidden by default. The emerging pattern is to embed encrypted Travel Rule payloads within the transaction memo field, readable only by the recipient institution and, upon lawful request, by regulators holding a viewing key.',
          'Zero-knowledge proofs can attest that the payload is well-formed and that both parties satisfy KYC requirements, without revealing the payload contents on-chain. Several vendors are building Travel Rule compliance layers that integrate with shielded pool architectures.',
        ],
        links: [
          { label: 'Regulatory disclosure', href: '/patterns/pattern-regulatory-disclosure-keys-proofs/' },
          { label: 'User-controlled viewing keys', href: '/patterns/pattern-user-controlled-viewing-keys/' },
        ],
      },
    ],
  },
  {
    label: 'Technology readiness',
    questions: [
      {
        q: 'Which privacy solutions are production-ready today?',
        a: [
          'Privacy-preserving KYC (zero-knowledge credential verification) is the most mature — several vendors offer production-grade solutions. L1 shielded pools are production for individual use but institutional adoption is still early. Privacy L2s are approaching mainnet but not yet production for institutional workloads. FHE-based solutions are at the proof-of-concept stage.',
          'The honest answer: no single privacy architecture is fully production-ready for all institutional use cases today. The practical path is to pick the approach whose maturity matches your deployment timeline and risk tolerance.',
        ],
        links: [
          { label: 'Private Identity', href: '/approaches/approach-private-identity/' },
          { label: 'Railgun', href: '/vendors/railgun/' },
          { label: 'Aztec', href: '/vendors/aztec/' },
        ],
      },
      {
        q: 'How do viewing keys work for regulatory access?',
        a: [
          'Viewing keys are cryptographic keys that grant read-only access to shielded transaction data without granting transfer authority. A user or institution holds a spending key (for moving funds) and a separate viewing key (for disclosure). The viewing key can be shared with a regulator or auditor, who can then decrypt and verify specific transactions without seeing anything else in the pool.',
          'The key properties: viewing keys are scoped (can be time-bounded or limited to specific accounts), they are read-only (no transfer authority), and they can be revoked. Dual-key architecture works in both L1 shielded pools and L2 privacy systems.',
        ],
        links: [
          { label: 'User-controlled viewing keys', href: '/patterns/pattern-user-controlled-viewing-keys/' },
          { label: 'Regulatory disclosure', href: '/patterns/pattern-regulatory-disclosure-keys-proofs/' },
        ],
      },
      {
        q: 'UTXO vs account model: which is better for privacy?',
        a: [
          'UTXO-based privacy (Railgun, Zcash-style) provides stronger unlinkability by default — each transaction consumes and creates new notes, breaking the connection between sender and receiver. Account-based privacy (Aztec, FHE-based) is more familiar to Ethereum developers and supports richer programmability, but requires more careful design to prevent linkability.',
          'For institutional payments, UTXO models are simpler and better understood. For complex smart contract interactions (DeFi, derivatives), account-based privacy L2s offer more flexibility. The right choice depends on your use case rather than any absolute technical superiority.',
        ],
        links: [
          { label: 'Private Payments', href: '/approaches/approach-private-payments/' },
        ],
      },
    ],
  },
];

/** Find an FaqEntry by its question string. Used by the homepage teaser. */
export function findFaq(question: string): FaqEntry | undefined {
  for (const cat of faqCategories) {
    const hit = cat.questions.find((q) => q.q === question);
    if (hit) return hit;
  }
  return undefined;
}
