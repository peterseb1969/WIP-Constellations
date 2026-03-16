# WIP Use Cases — Domain Exploration (Day 4)

## The Generic Pattern

> Multiple authoritative external sources each describe overlapping real-world entities using incompatible identifiers, inconsistent vocabularies, and varying schemas. No single source is complete. The consumer needs a coherent, queryable view across all of them without becoming dependent on any one.

This pattern appears in every domain below. WIP's Registry synonym mechanism is the common solution.

---

## B2B Electronics Distribution

A distributor buys from fifty vendors, each with incompatible part numbering, category taxonomies, unit-of-measure conventions, pricing structures, and lifecycle status codes. The distributor needs to answer: who else makes this component, what's the lead time across suppliers, which alternatives are pin-compatible?

**WIP fit:** The canonical component becomes a WIP document. Every vendor's part number becomes a synonym. Product categories normalise to shared terminologies. Cross-vendor queries become trivial.

## Financial Securities

A fixed income desk receives data from Bloomberg, Reuters, and internal pricing. The same bond has a CUSIP, ISIN, SEDOL, Bloomberg ID, and Reuters RIC. Portfolio reconciliation across feeds is a daily manual exercise.

**WIP fit:** The synonym mechanism was almost literally designed for this — one canonical instrument, five external identifiers, all resolving to the same entity.

## Legal Document Management

"Article 13(2)(b) of Directive 2004/39/EC as amended by Directive 2014/65/EU (MiFID II)" is a version-controlled legal instrument with EU identifiers, national transpositions, commentary, and case law referencing specific versions.

**WIP fit:** The most demanding test of the full stack — Registry synonyms for cross-jurisdiction IDs, ontology for typed legal relationships (applies, overrules, modifies, implements), versioning for law as it changes, reporting for legal analytics, MCP+LLM for grounded citation.

## Fictional Universe Management

See [WIP_UseCase_FictionalUniverses.md](WIP_UseCase_FictionalUniverses.md) for the full document.

The most unexpected and most effective proof of domain-agnosticism. The same Registry that resolves IBANs also resolves Gandalf's eight names. The same ontology that tracks regulatory amendments tracks "Jaime --[betrayed]--> Aerys."

---

*These use cases emerged from Day 4 conversations between Peter and Critical-Claude. Each exercises WIP's core architecture without requiring domain-specific features — demonstrating the generic platform thesis.*
