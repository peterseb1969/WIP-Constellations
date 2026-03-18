# PoNIFs — Powerful, Non-Intuitive Features

*A guide to the things that make WIP powerful and the things that make WIP confusing — which are the same things.*

---

## What Is a PoNIF?

A **PoNIF** (Powerful, Non-Intuitive Feature) is a design decision that:

1. **Enables a genuinely powerful capability** that simpler designs cannot provide
2. **Violates the expectations** of developers (human or AI) trained on conventional patterns
3. **Will be gotten wrong** on first contact, and sometimes on second and third contact
4. **Cannot be simplified away** without losing the capability it provides

PoNIFs are not bugs. They are not accidental complexity. They are the price of capabilities that matter — versioning that never loses history, identity resolution that works across systems, validation that catches mistakes the developer didn't know they were making.

The challenge is not to remove PoNIFs. It is to:
- **Document them** so they are understood before they are encountered
- **Provide sensible defaults** so the common case works without understanding the PoNIF
- **Design guardrails** so the PoNIF's power is available when needed but doesn't bite when it isn't

---

## WIP's PoNIFs

### 1. Nothing Ever Dies

**The feature:** Every entity in WIP — terms, terminologies, templates, documents — has an ID that persists forever. Deactivation (soft-delete) makes an entity unavailable for future use, but it always resolves for existing references. Historical data never breaks.

**Why it's powerful:** A document created in 2024 referencing term `ACTIVE` will always resolve that reference, even if `ACTIVE` was deactivated in 2025. Audit trails are complete. Regulatory compliance is built in. You cannot accidentally destroy data integrity by cleaning up old vocabularies.

**Why it's non-intuitive:** Every developer's instinct is "delete the old one." Every AI's training says "clean up unused resources." The concept of an entity that is simultaneously "gone" (can't be used in new data) and "present" (resolves in old data) doesn't exist in most systems.

**What goes wrong:** Users deactivate a term and expect all documents using it to fail. They don't — they keep working. Users expect deactivated templates to be invisible. They're not — they still resolve when documents reference them. The mental model of "inactive = deleted" is wrong; the correct model is "inactive = retired."

**Sensible default:** The current behaviour is the correct default. But documentation should be explicit: *"Inactive means retired, not deleted. Retired entities are invisible to new data but always visible to existing data."*

### 2. Template Versioning — Multiple Active Versions

**The feature:** Template updates create new versions. The old version remains active. Multiple versions of the same template can be active simultaneously. New documents can be created against any active version. Existing documents retain their original template version reference.

**Why it's powerful:** Schema evolution without migration. A new field can be added to a template (v2) while existing documents remain valid against v1. Both versions coexist. No downtime, no batch migration, no breaking changes.

**Why it's non-intuitive:** In every other system, updating a schema replaces the old one. There is one active schema, and all data conforms to it. The idea that two versions of the "same" template are both valid simultaneously — and that the system doesn't automatically migrate data to the latest version — contradicts every ORM, every database migration tool, and every schema registry the developer has ever used.

**What goes wrong:** 
- A developer updates a template to fix a field type. Both versions remain active. New documents might be created against either version depending on which one the client resolves. (This caused the Day 4 `file_config` bug — the bootstrap created v1 with PDF-only restriction, the fix created v2, but the cached v1 was still active and being used.)
- An AI updates a template and assumes the old version is gone. It isn't. The AI doesn't deactivate the old version because that's not what "update" means in any system it was trained on.

**Sensible default:** `@wip/client`'s `updateTemplate()` should deactivate the previous version by default, with an option to keep it active: `updateTemplate(id, fields, { keepPreviousActive: true })`. The PoNIF (multiple active versions) remains available for advanced use cases, but the common case — "I updated the template, use the new one" — works without thinking about it.

### 3. Document Identity — The Registry Decides

**The feature:** Documents don't need an explicit ID to be updated. Instead, templates define identity fields. When a document is submitted, WIP computes an identity hash from those fields. If a document with the same hash exists, it's a new version (update). If not, it's a new document (create). The same endpoint handles both — it's an upsert, not a create-or-update decision.

**Why it's powerful:** Data pipelines don't need to track IDs. Import the same CSV twice — identical records are deduplicated, changed records get new versions, new records are created. No "does this exist?" query before every insert. No ID mapping tables. The data defines its own identity.

**Why it's non-intuitive:** 
- Developers expect to control the ID. They expect `POST` to create and `PUT` to update. WIP's `POST` does both, and the identity fields — not the URL, not a client-provided ID — determine which.
- If a template has zero identity fields, every submission creates a new document. There is no update path. This is by design (some data, like event logs, is append-only), but it surprises developers who expect every entity to be updatable.
- If the identity fields are wrong (too many — correcting a field creates a new document instead of a version; too few — different real-world entities collide), the consequences are silent and structural. There's no error — just wrong versioning behaviour.

**What goes wrong:**
- An AI adds a timestamp to the document data. Now every import creates new documents instead of updating existing ones — the timestamp makes every identity hash unique.
- A developer defines all fields as identity fields. Now correcting a typo creates a new document instead of a new version.
- A template has no identity fields. The developer tries to "update" a document and gets a duplicate instead.

**Sensible default:** `@wip/client` should warn (not error) when creating a document against a template with zero identity fields. The warning should say: *"Template X has no identity fields. Every submission will create a new document. If you intend updates, add identity fields to the template."*

### 4. Bulk First — 200 OK Always

**The feature:** All WIP write endpoints accept arrays and return `200 OK` even when individual items fail. The response body contains per-item status (`created`, `updated`, `error`, `skipped`). This includes `DELETE`, which takes a JSON body array, not an ID in the URL.

**Why it's powerful:** Batch operations are first-class. A 10,000-record import doesn't fail on record 47 and lose records 1-46 or skip 48-10,000. Every record gets its own status. Error handling is granular. And the array-in, array-out pattern is consistent across every endpoint.

**Why it's non-intuitive:**
- REST conventions say `DELETE /resource/{id}`, not `DELETE /resource` with a body. Every developer will try the URL-based pattern first and get `405 Method Not Allowed`.
- A `200 OK` response that contains errors inside is contrary to HTTP semantics. Developers (and AIs) check the status code, see 200, and assume success. The per-item errors are invisible unless the response body is parsed.
- Single-item operations still require wrapping in an array (or the client library handles this).

**What goes wrong:**
- On Day 4, Constellation-Claude tried four different `DELETE` URL patterns before WIP-Claude explained the bulk-first convention. Each attempt returned 405. The AI's training on REST conventions was a liability, not an asset.
- The Statement Manager's import showed "Imported 0 items with 1 error" when 911 transactions were actually created — the FIN_IMPORT tracking record failed, and the app checked only the response status code (200) and the error count, not the success count.

**Sensible default:** `@wip/client` already wraps single items in arrays transparently. The remaining gap is error surfacing — the library should provide helpers like `response.hasErrors()`, `response.successCount`, `response.errors` that make it hard to miss partial failures.

### 5. Registry Synonym Management

**The feature:** Any entity in WIP can have multiple identifiers (synonyms) registered in the Registry. A synonym can be any key-value pair: `{"erp_id": "SAP-001"}`, `{"iban": "CH93 0076..."}`, `{"gandalf_name": "Mithrandir"}`. All synonyms resolve to the same canonical WIP ID. Lookup by any synonym is O(1), as fast as lookup by canonical ID.

Additionally, two WIP IDs can be declared as synonyms of each other (merge), and a WIP ID can be deprecated in favour of another (redirect). The Registry maintains the full resolution chain. Crucially, merges are reversible — deleting the synonym "unmerges" the entities. And a single real-world entity can have multiple WIP IDs, not just one. Merging is reversible — delete the synonym that linked the two IDs and they separate again.

An entity can have multiple WIP IDs. This is not a bug or an edge case — it's a legitimate state. Different systems may have independently created Registry entries for the same real-world entity before anyone knew they were the same.

**Why it's powerful:** Cross-system integration without mapping tables. Your bank's account number, your employer's ID, your broker's reference — all resolve to the same WIP entity. Import data using any external identifier; WIP resolves it transparently. The same mechanism that links IBAN numbers links Gandalf's eight names.

**Why it's non-intuitive:**
- Most systems have one ID per entity. Two at most (internal + external). The idea of an entity with an unlimited number of identifiers, all equally valid for lookup, doesn't match any ORM or API framework's assumptions.
- The assumption that one entity = one WIP ID is deeply ingrained. In reality, an entity can have as many WIP IDs as you want — and merging them (making one a synonym of another) is how you reconcile duplicates discovered after the fact. This is a PoNIF within the PoNIF.
- Synonym resolution happens transparently during document creation. If a reference field contains a value that matches a synonym, it resolves. The developer might not even know synonyms are being used — which is both the power and the confusion.
- Merging two WIP IDs is reversible (delete the synonym to unmerge), but developers trained on "merge = permanent destructive operation" will be afraid to use it, or conversely, will be surprised that an unmerge is possible.

**What goes wrong:**
- A developer assumes each entity has exactly one WIP ID. They discover two IDs for the same entity and panic, thinking the data is corrupt. It's not — it's the normal state before reconciliation. The merge operation exists precisely for this.
- A developer registers the same external ID as a synonym for two different WIP entities. The Registry rejects this (correctly), but the error message is about "duplicate search values," which doesn't explain what happened.
- An AI creates documents with a reference value of "CUS-001". If a synonym maps "CUS-001" to a WIP document, the reference resolves. If no synonym exists, WIP falls back to business key lookup. If the business key lookup also fails, the document is rejected. The AI doesn't know which resolution path was attempted or which one failed.

**Sensible default:** `@wip/client` should surface the resolution path in reference errors: *"Reference 'CUS-001' for field 'customer' could not be resolved. Attempted: direct ID (not a UUID), Registry synonym (not found), business key on CUSTOMER template (no match)."* The developer needs to know *why* resolution failed, not just *that* it failed.

---

## PoNIFs and AI Assistants

### The Compactheimer's Problem

AI assistants (Claude, GPT, etc.) have a specific failure mode with PoNIFs that humans don't: **they forget.**

When an AI starts a session, it reads CLAUDE.md, understands the PoNIFs, and works correctly. As the context window fills and compaction occurs, the AI loses the specific instructions and reverts to its training — which is trained on conventional patterns. The AI doesn't know it has forgotten. It continues working confidently, but now it:

- Tries `DELETE /resource/{id}` instead of the bulk pattern
- Assumes updating a template deactivates the old version
- Adds timestamps to document data (breaking idempotent import)
- Expects identity fields to be mandatory (adding synthetic ones to templates that don't have them)

This happened during the experiment:
- WIP-Claude at some point added a random field to templates without identity fields, assuming every template needs one. It assumed this because that IS the normal pattern in application development.
- Constellation-Claude tried four `DELETE` URL patterns before being told about bulk-first
- The template cache fix was needed partly because neither Claude instance passed `template_version` — they relied on the "latest" default, which is the conventional pattern

### The Mitigation Strategy

1. **CLAUDE.md must document PoNIFs explicitly**, with the conventional pattern and the WIP pattern side by side. Not just "how it works" but "how it differs from what you expect."

2. **`@wip/client` must encode PoNIF-aware defaults** so that the common case works correctly even when the AI forgets the documentation. The library is the last line of defence against Compactheimer's.

3. **Guardrails in the process** — the slash commands (`/build-app`, `/improve`) should include PoNIF checkpoints: "Does the app pass `template_version`? Does it handle partial failures in bulk responses? Does it add any per-run data to document fields?"

4. **Tests should verify PoNIF behaviour** — not just "does the feature work?" but "does the feature work the way WIP does it, not the way conventional systems do it?" Test that re-importing the same file creates zero new versions. Test that updating a template leaves the old version active. These are the behaviours that drift.

---

## The PoNIF Principle

> **A PoNIF that surprises the user once is a documentation failure. A PoNIF that surprises the user twice is a defaults failure. A PoNIF that surprises the user three times is a design failure.**

WIP's PoNIFs are in the first and second category. The features are correct. The documentation is catching up. The defaults (especially in `@wip/client`) need work to make the common case safe without removing the power from the advanced case.

The goal is not to remove the non-intuitive behaviour. It's to make the intuitive path lead to the correct behaviour, while keeping the non-intuitive path available for those who need it.

---

## Action Items

| PoNIF | Documentation | Sensible Default | Status |
|---|---|---|---|
| Nothing ever dies | CLAUDE.md versioning section | Current behaviour is correct | ✓ Documented |
| Multiple active template versions | CLAUDE.md versioning table | `updateTemplate()` should deactivate previous by default | Pending |
| Document identity via Registry | CLAUDE.md, AI-Assisted-Dev.md | Warn on zero identity fields | Pending |
| Bulk first / 200 OK always | CLAUDE.md WIP Access Rules | `@wip/client` wraps singles; needs `hasErrors()` helper | Partial |
| Registry synonyms | AI-Assisted-Dev.md | Surface resolution path in errors | Pending |
| Compactheimer's drift | This document | PoNIF checkpoints in slash commands | Pending |

---

*This document emerged from Day 4 of the WIP Constellation experiment, after repeated encounters with the same pattern: a correct-but-surprising WIP behaviour causing confusion for AI assistants and requiring explicit correction. The term "PoNIF" was coined by Peter to name the pattern and make it discussable. Every bug in the experiment that wasn't a real bug — every "fix" that was actually a misunderstanding — traces back to a PoNIF that wasn't yet documented or defaulted.*
