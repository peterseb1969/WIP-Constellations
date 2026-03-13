Bootstrap a WIP instance with the constellation's data model. Use this to set up a fresh WIP instance, replicate the experiment, or recover from a lost database.

## What this does

Reads declarative seed files from `data-model/` in the constellation repo and creates all terminologies, terms, and templates in WIP via MCP tools. This is the executable equivalent of the data model documentation — if the seed files are in git, the data model is reproducible.

## Prerequisites

- WIP instance running and healthy (`get_wip_status` returns all green)
- WIP MCP server connected
- Seed files present in `data-model/` directory

## Seed file structure

```
data-model/
├── terminologies/
│   ├── FIN_CURRENCY.json
│   ├── FIN_ACCOUNT_TYPE.json
│   ├── FIN_TRANSACTION_TYPE.json
│   ├── FIN_TRANSACTION_CATEGORY.json
│   └── FIN_PAYSLIP_LINE_CATEGORY.json
├── templates/
│   ├── 01_FIN_ACCOUNT.json          # Numbered for creation order
│   ├── 02_FIN_TRANSACTION.json
│   ├── 03_FIN_PAYSLIP.json
│   └── 04_FIN_PAYSLIP_LINE.json
└── seed-data/                        # Optional: test/sample documents
    ├── accounts.json
    ├── sample-transactions.json
    └── sample-payslip.json
```

### Terminology file format

```json
{
  "code": "FIN_CURRENCY",
  "label": "Currencies",
  "description": "ISO 4217 currency codes used across the financial constellation",
  "terms": [
    { "value": "CHF", "label": "Swiss Franc", "aliases": [] },
    { "value": "EUR", "label": "Euro", "aliases": [] },
    { "value": "USD", "label": "US Dollar", "aliases": ["Dollar"] },
    { "value": "GBP", "label": "British Pound", "aliases": ["Sterling"] }
  ]
}
```

### Template file format

```json
{
  "code": "FIN_ACCOUNT",
  "label": "Financial Account",
  "description": "Bank account, credit card, share depot, or employer",
  "identity_fields": ["iban"],
  "fields": [
    { "name": "iban", "label": "IBAN", "type": "string", "mandatory": true },
    { "name": "institution", "label": "Institution Name", "type": "string", "mandatory": true },
    { "name": "account_type", "label": "Account Type", "type": "term", "mandatory": true, "terminology_ref": "FIN_ACCOUNT_TYPE" },
    { "name": "primary_currency", "label": "Primary Currency", "type": "term", "mandatory": true, "terminology_ref": "FIN_CURRENCY" },
    { "name": "holder_name", "label": "Account Holder", "type": "string", "mandatory": false },
    { "name": "account_number", "label": "Account Number", "type": "string", "mandatory": false },
    { "name": "swift_bic", "label": "SWIFT/BIC", "type": "string", "mandatory": false },
    { "name": "description", "label": "Description / Nickname", "type": "string", "mandatory": false }
  ]
}
```

Note: template files use `mandatory` (not `required`) and `terminology_ref` (not `terminology_id`) — the correct WIP field names. See LESSONS_LEARNED.md Entries 001 and 006.

## Steps

### 1. Check current WIP state
Call `get_wip_status` and `list_terminologies` and `list_templates`.

If terminologies or templates from the seed files already exist:
- **Identical:** skip (idempotent — safe to re-run bootstrap)
- **Different version:** warn the user and ask whether to update or skip
- **Conflict (same code, different structure):** stop and ask the user

### 2. Create terminologies (in any order)
For each file in `data-model/terminologies/`:
- Read the JSON file
- Check if the terminology already exists in WIP (by code)
- If not, create it: `create_terminology({code, label, description})`
- Create all terms: `create_terms(terminology_id, terms)`
- Verify: `search_terms(terminology_id, "")` — confirm count matches

### 3. Create templates (in numbered order)
For each file in `data-model/templates/` sorted by filename prefix:
- Read the JSON file
- Check if the template already exists in WIP (by code)
- If not, create it: `create_template({code, label, fields, identity_fields, ...})`
- Verify: `get_template_schema(code)` — confirm fields match

### 4. Create seed data (optional)
If `data-model/seed-data/` exists and the user confirms:
- Create documents from each file
- These are sample/test documents, not production data

### 5. Summary
Report:
- Terminologies: created / skipped / failed
- Templates: created / skipped / failed
- Seed documents: created / skipped (if applicable)
- Any warnings or conflicts

## When to use this

- **Fresh WIP instance:** run `/bootstrap` to set up the full data model before any app development
- **Replication:** someone cloning the constellation repo runs `/bootstrap` on their own WIP instance
- **Recovery:** after a database loss, run `/bootstrap` to recreate the data model (documents are lost, but the structure is restored)
- **CI/testing:** automated tests can bootstrap a test namespace, run tests, then clean up

## When to update seed files

After any Phase 2/3 cycle that changes the data model:
- New terminology → add a new file to `data-model/terminologies/`
- New template → add a new file to `data-model/templates/`
- Modified template (new field, changed identity) → update the existing file
- New terms added to a terminology → update the existing file

**The seed files ARE the version-controlled data model.** If it's not in a seed file, it doesn't exist in git, and it can't be reproduced.
