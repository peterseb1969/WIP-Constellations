Export the current WIP data model to declarative seed files. Use this to capture work done via MCP tools into version-controlled files that can reproduce the data model on any WIP instance.

## Why this exists

During Phases 2–3, you create terminologies and templates interactively via MCP tools. That's efficient for development, but the results live only in the running WIP instance — not in git. This command captures the current state as seed files, closing the gap between "what's in WIP" and "what's in the repo."

**Run this after every Phase 3 completion, before committing.**

## Steps

### 1. Create directory structure
```
mkdir -p data-model/terminologies
mkdir -p data-model/templates
mkdir -p data-model/seed-data
```

### 2. Export terminologies
For each terminology returned by `list_terminologies`:
- Skip system terminologies (prefixed with `_`, e.g., `_ONTOLOGY_RELATIONSHIP_TYPES`, `_TIME_UNITS`)
- Skip terminologies not related to the constellation being built (e.g., biomedical ontologies like HP, GO)
- For each relevant terminology:
  - Fetch the terminology metadata
  - Fetch all terms: `search_terms(terminology_id, "")`
  - Write to `data-model/terminologies/{CODE}.json` in the seed file format:

```json
{
  "code": "FIN_CURRENCY",
  "label": "Currencies",
  "description": "ISO 4217 currency codes used across the financial constellation",
  "terms": [
    { "value": "CHF", "label": "Swiss Franc", "aliases": [] },
    { "value": "EUR", "label": "Euro", "aliases": [] }
  ]
}
```

### 3. Export templates
For each template returned by `list_templates`:
- Fetch the full template schema: `get_template_schema(code)`
- Determine creation order from references (templates that reference others must be numbered higher)
- Write to `data-model/templates/{NN}_{CODE}.json` where NN is the creation order:

```json
{
  "code": "FIN_ACCOUNT",
  "label": "Financial Account",
  "description": "Bank account, credit card, share depot, or employer",
  "identity_fields": ["iban"],
  "fields": [
    { "name": "iban", "label": "IBAN", "type": "string", "mandatory": true },
    { "name": "account_type", "label": "Account Type", "type": "term", "mandatory": true, "terminology_ref": "FIN_ACCOUNT_TYPE" }
  ]
}
```

Use the correct WIP field names: `mandatory` (not `required`), `terminology_ref` (not `terminology_id`).

### 4. Optionally export sample documents
If the user wants to preserve test/seed data:
- Query a small set of documents per template
- Write to `data-model/seed-data/{template_code}.json`
- **Redact sensitive data** if the documents contain real financial information

### 5. Verify round-trip
After exporting, confirm the seed files could recreate the data model:
- Read each terminology file, compare against WIP
- Read each template file, compare against WIP
- Report any discrepancies

### 6. Commit
```
git add data-model/
git commit -m "Export data model: N terminologies, M templates"
```

## When to run this

- **After Phase 3 of any app** — capture the terminologies and templates just created
- **After /improve sessions that touched the data model** (Rule 6 in /improve)
- **Before any major git milestone** — ensure the repo is self-contained
- **Periodically** — as a safety net, especially if terms are added interactively

## The rule

**If it's not in `data-model/`, it doesn't exist in git, and it can't be reproduced.** The MCP tools are the fast path for creation. The seed files are the durable record. Both are needed.
