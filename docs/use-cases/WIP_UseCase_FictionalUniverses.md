# World In a Pie for Fictional Universe Management

## The Idea

World In a Pie is a generic, domain-agnostic storage and reporting engine. Most of its documented use cases lean toward the serious — clinical trial data, B2B catalog reconciliation, legal document management. But the architecture makes no distinction between a regulatory submission and a hobbit. The primitives — terminologies, templates, versioned documents, typed ontology relationships, Registry synonyms — are exactly what a complex fictional universe demands.

This document explores using WIP to track characters, relationships, bloodlines, factions, places, and events across fictional works. It works equally well for published universes like Tolkien's Middle-earth or George R.R. Martin's Westeros, and for original fiction being actively written. The MCP server integration with Claude closes the loop — turning the structured data into a queryable, conversational continuity assistant.

---

## Why Fictional Universes Are Hard to Track

The naive approach — a wiki, a spreadsheet, a folder of notes — breaks down quickly for any universe of meaningful complexity. The problems are familiar:

- **Identity ambiguity**: the same character has many names, titles, and aliases across different contexts
- **Disputed facts**: two sources disagree about a character's parentage, the date of an event, or the outcome of a battle
- **Cross-work continuity**: a character appears in works by different authors, or the same author returns to a character decades later
- **Version history**: a character changes — is resurrected, renamed, transformed — and earlier references need to remain valid
- **Relationship complexity**: bloodlines, alliances, enmities, and mentorships form a dense graph that changes over time
- **Scale**: a universe like LOTR or GoT has hundreds of named characters, thousands of relationships, and decades of in-universe timeline

WIP solves all of these as a natural consequence of its core architecture. None of it requires special-casing for fiction.

---

## The Identity Problem in Fictional Universes

### Tolkien Will Break a Naive System Immediately

The Registry's synonym mechanism earns its existence the moment you try to model Gandalf.

Gandalf is known by at least six names across different cultures, languages, and periods of his existence:

| Name | Used by | Context |
|------|---------|---------|
| Gandalf | Men of the North | His most common name in The Hobbit and LOTR |
| Mithrandir | Elves (and Gandalf himself) | Sindarin, meaning "Grey Pilgrim" |
| Olórin | Valinor | His original Maia name before coming to Middle-earth |
| Greyhame | Rohirrim | "Grey-cloak" in the language of Rohan |
| Incánus | Haradrim | His name in the south |
| Tharkûn | Dwarves | His Khuzdul name |
| The Grey Pilgrim | Various | Descriptive title |
| The White Rider | Various | After his return as Gandalf the White |

Without synonym management, you end up with eight Gandalfs. Queries for "all scenes featuring Gandalf" miss every scene where he is called Mithrandir. Cross-references from Elvish texts to Common Tongue texts break. The bibliography of a serious Tolkien scholar becomes incomprehensible.

In WIP, there is one canonical CHARACTER document for Gandalf. Every name above is a registered synonym. Any reference to any of these names resolves to the same entity. A query for "all relationships involving this character" returns the complete picture regardless of which name the source used.

### Aragorn — Synonyms with Temporal Metadata

Aragorn's names are not just aliases — they belong to specific periods of his life and are used by specific groups. This is richer than a flat synonym list:

| Name | Period | Used by |
|------|--------|---------|
| Estel | Childhood in Rivendell | Elves (meaning "Hope", his true identity hidden) |
| Strider | Third Age, wandering years | Men of Bree and the Shire |
| Dúnedain Chieftain | Throughout | Rangers of the North |
| Thorongil | Service under Steward Ecthelion | Men of Gondor |
| Aragorn son of Arathorn | His true name | Used formally |
| Elessar | His kingship name | Elvish, meaning "Elfstone" |
| King Elessar Telcontar | Coronation and beyond | Official royal title |

The synonym mechanism handles the identity reconciliation. The temporal and contextual metadata about *when* and *by whom* each name is used becomes fields on the synonym record itself, making it queryable: "what was Aragorn known as during his service in Gondor?"

### Jon Snow — Disputed Identity as a First-Class Concept

Jon Snow's true parentage — the son of Rhaegar Targaryen and Lyanna Stark, making him Aegon Targaryen, heir to the Iron Throne — is one of the most consequential identity revelations in Game of Thrones. But for most of the story, it is disputed, unknown, or deliberately concealed.

A naive system either stores the "correct" answer and loses the history of uncertainty, or stores both and has no way to express confidence or provenance. WIP handles this naturally:

```
PARENTAGE_CLAIM document:
  subject: Jon Snow (CHARACTER document)
  claimed_parent: Eddard Stark (CHARACTER document)
  claim_type: "paternal"
  source: "Common knowledge in Westeros"
  confidence: "believed"
  valid_until: Season 7

PARENTAGE_CLAIM document:
  subject: Jon Snow (CHARACTER document)  
  claimed_parent: Rhaegar Targaryen (CHARACTER document)
  claim_type: "paternal"
  source: "Tower of Joy vision, Samwell Tarly records"
  confidence: "confirmed"
  valid_from: Season 7
```

Both claims coexist as versioned documents. Queries can filter by confidence, by source, or by point-in-timeline. The history of what was believed and when is preserved. Claude, querying via MCP, can answer "what was believed about Jon's parentage before Season 7?" and "what was confirmed afterward?" as distinct questions.

---

## The Ontology Layer — Typed Relationships

Simple document references are not enough for a fictional universe. The *type* of relationship carries meaning that changes what queries are possible and what conclusions are valid.

### Core Relationship Types

```
# Blood and family
CHARACTER --[parent_of]--> CHARACTER
CHARACTER --[sibling_of]--> CHARACTER
CHARACTER --[married_to]--> CHARACTER
CHARACTER --[adopted_by]--> CHARACTER
CHARACTER --[descended_from]--> CHARACTER  (supports polyhierarchy traversal)

# Transformation and continuity
CHARACTER --[reincarnation_of]--> CHARACTER
CHARACTER --[successor_to]--> CHARACTER
CHARACTER --[same_entity_as]--> CHARACTER   (cross-author appearances)
CHARACTER --[alter_ego_of]--> CHARACTER

# Social and political
CHARACTER --[mentor_of]--> CHARACTER
CHARACTER --[sworn_to]--> CHARACTER
CHARACTER --[betrayed]--> CHARACTER
CHARACTER --[allied_with]--> CHARACTER
CHARACTER --[enemy_of]--> CHARACTER
CHARACTER --[member_of]--> FACTION
CHARACTER --[rules]--> PLACE

# Events
CHARACTER --[killed_by]--> CHARACTER
CHARACTER --[killed]--> CHARACTER
CHARACTER --[present_at]--> EVENT
EVENT --[caused_by]--> CHARACTER
EVENT --[resulted_in]--> EVENT
EVENT --[preceded_by]--> EVENT

# Narrative
CHARACTER --[appears_in]--> WORK
WORK --[set_in]--> PLACE
WORK --[canonical_in]--> UNIVERSE
WORK --[contradicts]--> WORK
WORK --[expands_on]--> WORK

# Legal and inheritance
CHARACTER --[heir_to]--> CHARACTER
CHARACTER --[claims_title_of]--> CHARACTER
FACTION --[vassal_of]--> FACTION
FACTION --[enemy_of]--> FACTION
```

### Why Typed Relationships Matter

Consider these two statements about the same pair of characters:

- Boromir *is the brother of* Faramir
- Boromir *died before* Faramir became Steward

The first is a `sibling_of` relationship. The second is an `EVENT --[preceded_by]--> EVENT` chain with character involvement. They are fundamentally different kinds of assertions requiring different query patterns. A system that stores both as generic "links" cannot distinguish them. WIP's typed ontology relationships can.

The traversal query capability means you can ask: "give me all characters descended from Númenórean kings" — and the system walks the `descended_from` graph across multiple generations, returning Aragorn, Boromir, Faramir, Denethor, and the full lineage, without you having to know how many generations deep it goes.

### The Gandalf the Grey / Gandalf the White Problem

Is Gandalf the Grey the same entity as Gandalf the White?

Theologically in Tolkien's universe: he was sent back by the Valar, his mission unfulfilled, in an enhanced form. Narratively: same memories, same essential personality, but transformed. Technically in WIP terms: **a new document version of the same identity**.

```
CHARACTER document version 1:
  canonical_name: Gandalf
  order: Istari
  colour: Grey
  status: active (until Fellowship of the Ring, Moria)

CHARACTER document version 2:
  canonical_name: Gandalf  
  order: Istari
  colour: White
  status: active (from The Two Towers onward)
  supersedes: version 1
```

Same identity hash — because the identity fields (name, order) are unchanged. New version — because the attributes changed. Version 1 is deactivated when version 2 is created, but remains queryable. References from text written before his return correctly resolve to version 1. References from text written after resolve to version 2 by default, or to the specific version if pinned.

This is WIP's versioning behaviour applied without modification to a fictional metaphysics problem.

---

## Cross-Work Identity — The Hard Case

### LOTR and The Hobbit

Tolkien's own works span decades of publication and in-universe centuries of timeline. Bilbo Baggins appears in The Hobbit as a middle-aged hobbit on an adventure, and in LOTR as a very old hobbit at his eleventy-first birthday party, and again briefly in the appendices.

These are not different characters. They are the same entity at different points in time, appearing in different works. WIP handles this with a single canonical CHARACTER document for Bilbo, with work appearances tracked as relationships:

```
CHARACTER --[appears_in {chapters: [...], timeline_period: "TA 2941"}]--> THE_HOBBIT
CHARACTER --[appears_in {chapters: [...], timeline_period: "TA 3001-3021"}]--> LOTR
```

Queries for "all of Bilbo's appearances across Tolkien's works" return the complete picture. Queries for "who appears in both The Hobbit and LOTR" are trivial joins on the reporting layer.

### Cross-Author Appearances

The richer problem is characters who appear in works by different authors — authorised sequels, expanded universe novels, fan fiction treated as canonical within a particular reading community, or deliberate crossovers.

Frodo appearing in a derivative work by another author, or Sherlock Holmes appearing in one of the hundreds of continuation novels by different writers, requires establishing a relationship between the canonical entity (defined in the original work's namespace) and the derivative appearance.

In WIP:

```
WORK namespace: tolkien-canonical
  CHARACTER: Frodo Baggins (canonical entity)

WORK namespace: derivative-author-x
  CHARACTER: Frodo Baggins → synonym registered pointing to tolkien-canonical entity
```

The derivative work's character *is* the canonical character, via synonym. Queries across namespaces ("all works featuring Frodo, across all authors") work out of the box. The canonical namespace remains authoritative. Derivative namespaces extend it without polluting it.

This also handles the Sherlock Holmes universe, where the canonical Conan Doyle character has been extended, reinterpreted, and appeared in cross-universe stories by hundreds of authors. One canonical entity. Hundreds of synonyms and appearances. All queryable.

---

## The GoT Blood Relationship Graph

Game of Thrones is a torture test for any relationship tracking system. The Targaryen family tree alone features:

- Multi-generational incestuous marriages (uncle-niece, cousin-cousin, sibling-sibling in historical cases)
- Disputed parentage (most famously Jon Snow, but also questions around several others)
- Characters who don't know their own identity
- Retroactive reveals that recontextualise earlier relationships
- Parallel claims to the same title by multiple characters simultaneously

The polyhierarchy traversal in WIP's ontology means you can ask: "list all living characters with a valid claim to the Iron Throne, ranked by primogeniture" — and the system walks the `descended_from` and `heir_to` graph, applies the `killed` relationships to exclude dead claimants, and returns the result.

The disputed parentage pattern (described above for Jon Snow) applies to any contested claim. Each claim is a document with a source, a confidence level, and a validity period. The database does not need to pick a winner — it stores all claims and lets the query decide which to surface.

### The Frey Problem — Scale

House Frey has, canonically, over one hundred living members at the time of the Red Wedding. Tracking all of them, their relationships to Walder Frey, their sub-family branches, and their fates after the Red Wedding is the kind of scale problem that breaks a spreadsheet. WIP's bulk import APIs, combined with a well-designed template for `NOBLE_HOUSE_MEMBER` with identity fields `[house, given_name, generation]`, handles this as a data loading exercise. The ontology traversal then answers questions like "how many of Walder Frey's direct grandchildren survived the Red Wedding?" without manual counting.

---

## For Original Fiction — The Writer's Assistant

The use case that may be most practically valuable is not tracking existing published universes but supporting an original work in progress.

### The Continuity Problem

Three hundred pages into a novel, a writer faces questions like:

- Have these two characters ever been in the same location at the same time?
- What colour did I say her eyes were in chapter two?
- Did I establish whether this character knows about the treaty?
- Is the timeline consistent — could this character have travelled from the northern city to the coast in the time the narrative allows?
- Does this backstory reveal contradict anything established earlier?

These questions currently get answered by Ctrl+F in a manuscript, by index cards pinned to a corkboard, by a wiki that drifted out of sync with the actual text three rewrites ago, or by not answering them at all and hoping the copy editor catches it.

### WIP as World-Building Infrastructure

The writer maintains their world-building as WIP documents *as they write*, not as a separate documentation exercise:

- Each new character introduced becomes a CHARACTER document
- Each scene becomes an EVENT document with characters present, location, and timeline position
- Each relationship established becomes an ontology entry
- Each piece of backstory revealed becomes a LORE document with the chapter it appears in as provenance

The templates enforce consistency — you cannot create a CHARACTER without specifying identity fields, so you never end up with two characters who are subtly the same person under different names.

### Querying Your Own Manuscript via Claude

With the MCP server connecting Claude to the WIP instance containing your world, the continuity queries become conversational:

> *"Have Alara and the merchant from chapter one ever been in the same place?"*

Claude traverses EVENT documents, filters by character presence, and answers from your actual manuscript data — not from hallucination, not from a faulty memory of what you wrote, but from the structured record you've been maintaining.

> *"What does Alara know about the northern conspiracy at this point in the story?"*

Claude queries LORE documents filtered by the character's presence at scenes where relevant information was revealed, and returns a structured account of what she could know, when she learned it, and from whom.

> *"Is the journey from the capital to the coastal town feasible in four days given what I've established about travel times?"*

Claude queries PLACE documents for distance and terrain, EVENT documents for established travel precedents, and reasons about consistency.

> *"Does anything I'm about to reveal in chapter fifteen contradict what I established in chapters one through five?"*

This is the most powerful query. Claude reads the proposed reveal, queries the relevant documents in WIP, and surfaces any contradictions — before they go to an editor or a reader.

### Cross-Canon Consistency

For writers working in established universes — fan fiction, authorised tie-ins, shared world anthologies — the canonical universe loads into a separate WIP namespace. The writer's original content lives in their own namespace.

> *"Does anything in my story contradict established LOTR canon?"*

Claude reasons across both namespaces simultaneously, flagging any assertion in the writer's documents that conflicts with the canonical namespace. The canonical data is read-only and authoritative. The writer's namespace extends it.

---

## The Fan Experience — The Know-It-All Friend You Always Wanted

Forget query interfaces and structured data access patterns for a moment. What WIP + Claude actually is, for a fan, is something much simpler and much more fun: **the one friend who has read everything, remembers everything, never gets tired of talking about it, and is available at 2am.**

Not a search engine. Not a wiki. A conversation. With someone who genuinely knows their stuff and can be cheerfully insufferable about it.

---

### The Pub Argument Resolver

Every fan group has that moment. Someone makes a claim. Someone else disputes it. Phones come out. Nobody can find a definitive answer. The argument outlasts the drinks.

> **Fan A:** Legolas and Gimli basically invented cross-species friendship. Nothing like that existed before in Middle-earth.
>
> **Fan B:** That is completely wrong, what about—
>
> **WIP + Claude:** *[already querying the `allied_with` and `friendship` ontology relationships across races]* Actually, Círdan the Shipwright maintained close friendships with multiple Maia across the First Age, and the relationship between the Edain and the Elves of Beleriand during the Wars of Beleriand produced several documented cross-species bonds that predate Legolas and Gimli by thousands of years. That said, Legolas and Gimli are unique in one specific sense — they're the only documented case of a Dwarf and Elf forming a bond of genuine personal affection rather than political alliance. Fan B, you were right but for the wrong reasons.

Both fans are now annoyed and delighted simultaneously. This is the correct outcome.

---

### Trivial Pursuit at a Fan Convention

This is where WIP + Claude becomes genuinely dangerous for an event organiser's schedule.

Because WIP holds the complete structured universe — every character, every relationship, every event, every location, every date — Claude can generate trivia questions at any difficulty level, on demand, with verified answers and source citations. Not from training data. From the actual WIP documents.

**Easy tier:**
> *"What is the name of Bilbo Baggins' home in the Shire?"*
> Answer: Bag End. Source: The Hobbit, Chapter 1.

**Medium tier:**
> *"Which member of the Fellowship was present at the Council of Elrond but not originally intended to be part of the Company?"*
> Answer: Boromir — he came seeking interpretation of a dream, not intending to join. The Fellowship's composition was decided at the Council itself.

**Hard tier:**
> *"How many generations separate Thorin Oakenshield from Durin the Deathless, and which of his companions shares the most recent common ancestor with him?"*
> Claude queries the genealogy graph, counts generations, cross-references all thirteen dwarves, returns Balin — and the exact generational distance for both.

**Convention special — the audience participation round:**
> Claude generates a question live, based on a character the audience nominates, at a difficulty level they vote for, with a follow-up question automatically generated from whatever answer is given.

The follow-up question mechanic is what makes this special. Every answer opens a new question. A Trivial Pursuit game that never runs out of cards, generates questions tailored to the specific crowd, and gets harder the more the audience knows.

A host at a Tolkien convention could run this for hours. They would have to physically stop it.

**Bonus round — spot the deliberate mistake:**
> Claude generates a question with a subtly wrong answer embedded in it. The audience has to identify the error and correct it. This is genuinely difficult because Claude knows exactly which facts are close enough to be plausible.
> *"Fíli and Kíli were the youngest members of Thorin's company and the nephews of Balin. True or false?"*
> False — they were Thorin's nephews, not Balin's. Balin's brother was Dwalin. A casual fan might miss it. A real fan catches it in under two seconds and is very smug about it.

---

### WIP as the Ultimate Game Master Tool for D&D

This is where WIP's architecture clicks into place for an entirely different creative use case — and it's almost embarrassingly well suited for it.

A Dungeons & Dragons campaign is, structurally, exactly the fictional universe problem. You have:
- A cast of player characters and NPCs with relationships, histories, and secrets
- A world with places, factions, and power structures
- A timeline of events that accumulates session by session
- Lore that the GM knows and the players are discovering
- Consequences that ripple forward from earlier decisions

The GM currently tracks all of this in a combination of notebooks, Notion pages, Obsidian vaults, and their own increasingly unreliable memory. WIP replaces all of that with something structured, queryable, and Claude-accessible.

**The namespace structure writes itself:**

```
Namespace: world-canonical
  The permanent world — geography, history, factions, 
  ancient lore, gods, languages. Stable between campaigns.
  
Namespace: campaign-dragons-of-the-north
  Everything that happened in this specific campaign.
  Characters, events, decisions, consequences.
  Extends world-canonical but never modifies it.
  
Namespace: campaign-the-thieves-guild
  A different campaign in the same world, different players.
  Same world-canonical foundation, completely separate events.
```

The world-canonical namespace is the GM's world bible. Each campaign gets its own namespace, inheriting the world but accumulating its own history. Two campaigns can run in the same world simultaneously without stepping on each other. When an NPC from one campaign becomes relevant in another, the canonical character record is shared — but their experiences in each campaign are separate.

**During a session, the GM uses WIP + Claude in real time:**

> *"My players just asked whether the blacksmith in Millhaven has any connection to the Thieves' Guild. I didn't plan this. What does WIP know about the blacksmith?"*

Claude queries the NPC document for the blacksmith, traverses their `member_of`, `allied_with`, and `knows` relationships, and surfaces everything the GM has previously recorded — including a note from three sessions ago that the blacksmith's brother owed a debt to a Guild fence.

The GM didn't remember that note. WIP did. The session just got a lot more interesting.

> *"One of my players wants to investigate the ruins north of Millhaven. What do I have documented about that region?"*

Claude queries PLACE documents, EVENT documents referencing that location, and LORE documents tagged with that region — and returns a structured briefing the GM can improvise from.

**Between sessions, WIP is the campaign journal:**

After each session, the GM (or a player, if they're that organised) adds documents:
- New NPCs introduced
- Relationships established or broken
- Events that occurred
- Secrets revealed to the players
- Consequences pending

Over a year-long campaign, this accumulates into a complete structured history of the adventure. Every decision has a document. Every consequence is traceable.

**The player-facing version — the party's own knowledge base:**

Give the players read access to a filtered view of WIP — the things their characters actually know, filtered by the `known_to` field on LORE documents. They can ask Claude:

> *"What does my character know about the Duke of Millhaven?"*

Claude queries LORE documents where the character is in the `known_to` array, and returns exactly what that character has learned — no more, no less. No accidentally surfacing information their character wasn't present for. No GM accidentally giving away something they shouldn't.

**The continuity superpower:**

Six months into a campaign, a player says: *"Wait — didn't the innkeeper in the first village mention something about a silver wolf? I feel like that's connected to what we just found."*

Normal response: everyone tries to remember. Nobody can. The thread is lost.

WIP response: Claude queries EVENT documents from session one, finds the innkeeper's dialogue recorded as a LORE document, traverses the `silver_wolf` tag across all documents, and surfaces three other mentions across the campaign history — including one the players had completely forgotten that now makes everything click.

The players lose their minds. The GM looks like a genius who planned this all along. 

(The GM may or may not have actually planned this. WIP will not tell.)

---

### The Community Angle — Fans Building for Fans

The most exciting version of all of this is not a single fan or a single GM using WIP privately. It's a community building a shared WIP instance together.

The dedication required to populate a complete WIP instance for the full Tolkien legendarium — every character from the Silmarillion, every relationship in the appendices, every event in Unfinished Tales — is exactly the kind of project that fan communities organise around. They would argue about the correct ontology for Maia versus Valar. They would debate which parentage claims deserve `confidence: confirmed` versus `confidence: disputed`. They would submit pull requests to the terminology definitions.

And then they would all query it through Claude, at conventions and in Discord servers and at 2am during rewatches.

**A community of fans building a WIP instance together, then all chatting with it through Claude, is a new kind of fandom that doesn't quite exist yet.** The data they build is the thing they've always wanted. The conversations they have with it are the ones they've been trying to have with each other for decades — just finally with someone who has read everything and never gets the details wrong.

---

## Template Sketch

```
UNIVERSE
  identity: [name]
  fields: author, publication_years, canonical_works[], description

WORK
  identity: [universe_id, title]
  fields: author, publication_year, timeline_period, canonical: bool
  relationships: set_in (PLACE), part_of (UNIVERSE)

CHARACTER
  identity: [universe_id, canonical_name]
  fields: species, gender, birth_date, death_date (if applicable), 
          first_appearance (WORK reference), status (alive/dead/undead/transformed)
  synonyms: all known names and aliases

FACTION
  identity: [universe_id, name]
  fields: type (house/order/nation/guild), founded, dissolved, description

PLACE
  identity: [universe_id, canonical_name]
  fields: type, region, description, first_appearance

EVENT
  identity: [universe_id, name, timeline_date]
  fields: description, location (PLACE reference), 
          characters_present[] (CHARACTER references),
          significance

LORE
  identity: [universe_id, title]
  fields: content, revealed_in (WORK reference), 
          revealed_at_chapter, known_to[] (CHARACTER references)

PARENTAGE_CLAIM
  identity: [universe_id, subject_id, claimed_parent_id, claim_type]
  fields: source, confidence, valid_from, valid_until, notes

Ontology relationship types:
  parent_of, sibling_of, married_to, descended_from,
  mentor_of, sworn_to, betrayed, killed_by, killed,
  reincarnation_of, same_entity_as, alter_ego_of,
  member_of, rules, enemy_of, allied_with,
  appears_in, set_in, caused_by, resulted_in,
  heir_to, claims_title_of, vassal_of,
  contradicts, expands_on, inspired_by
```

---

## Why WIP and Not a Dedicated Wiki or Graph Database

This question deserves a direct answer.

**Versus a wiki (Fandom, Obsidian, Notion):**

Wikis are unstructured. You cannot enforce that every character has an identity field, that every relationship is typed, or that disputed claims are stored as claims rather than facts. Queries require full-text search, not graph traversal. Cross-wiki integration is manual copy-paste. Versioning is at the page level, not the entity level.

**Versus a dedicated graph database (Neo4j):**

A graph database handles the relationship traversal excellently but has no native concept of controlled vocabularies, document versioning, identity management across external sources, or the synonym mechanism. You would need to build all of that on top of it. WIP gives you the graph traversal through its ontology layer and everything else as part of the foundation.

**Versus a spreadsheet:**

No comment necessary.

**WIP's specific advantages for this use case:**

- The synonym mechanism handles the many-names-one-entity problem natively
- Document versioning handles character transformation and retroactive reveals correctly
- The disputed-claim-as-document pattern handles uncertain or contested facts without forcing a resolution
- The reporting layer enables SQL analytics across the universe
- The MCP integration with Claude turns the structured data into a conversational query interface
- Cross-namespace queries handle cross-author universes without conflating canonical and derivative content
- The never-delete principle means no lore is ever irretrievably lost — deactivated, yes, gone, never

---

## The Companion Use Case: Building Your Own Universe

WIP is not just a tool for cataloguing existing universes. For a writer building an original world from scratch, WIP enforces the world-building discipline that separates a coherent, internally consistent universe from a collection of good ideas that contradict each other by book three.

The forced structure is the feature. You cannot add a character without thinking about their identity fields. You cannot establish a relationship without typing it. You cannot record a disputed fact without sourcing it. The world-building happens in WIP first, and the manuscript draws from it — rather than the world-building being reconstructed after the fact from a manuscript that has already accumulated contradictions.

Combined with Claude as a conversational query interface via MCP, the writer has something that has never existed before: a continuity-aware creative assistant that knows their world as well as they do, can be asked any question about it, and answers from structured data rather than from the probabilistic approximations of a language model's training.

The world lives in WIP. Claude is the librarian.

---

*This document emerged from a conversation exploring non-obvious use cases for World In a Pie's generic architecture. The fictional universe domain exercises the Registry synonym mechanism, ontology typed relationships, document versioning, cross-namespace queries, and MCP integration simultaneously — making it one of the most complete demonstrations of WIP's full capability stack, despite being the most playful.*
