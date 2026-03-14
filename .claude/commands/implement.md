Execute Phase 3 (Implementation) of the AI-Assisted Development process.

## Prerequisites
Phase 2 must be complete with **explicit user approval** of the data model.
The WIP MCP server must be connected.

## Steps — Strict Order, Using MCP Tools

### Step 1: Create terminologies
For each terminology in the approved data model:
- Check if it already exists: `list_terminologies` — if found, skip creation
- Create the terminology: `create_terminology({code, name, description})`
- Create all terms: `create_terms(terminology_id, [{value, label, aliases, description}, ...])`
- Verify: `search_terms(terminology_id, "")` — confirm all terms are present
- Log: record the terminology ID and code

### Step 2: Create templates (referenced entities first)
For each template, in dependency order (referenced before referencing):
- Create the template: `create_template({code, name, fields, identity_fields, ...})`
- Verify: `get_template_schema(template_code)` — confirm all fields, identity fields, and references are correct
- Log: record the template ID, code, and version

### Step 3: Test with a single document
For each template:
- Create ONE test document: `create_document(template_id, data)`
- Verify: confirm the document was created with correct document_id and identity hash
- Test versioning: call `create_document` with the SAME identity fields but a changed non-identity field. Verify version increments to 2.
- Test validation: call `validate_document(template_id, bad_data)` with invalid data (bad term value, missing required field). Verify a clear validation error is returned.
- Test references: create a referencing document pointing to the first. Verify the reference resolves.

### Step 4: Test file operations (if applicable)
- Upload a test file (if the app uses file fields)
- Create a document linking to the file ID
- Verify the file is retrievable

### Step 5: Clean up or keep test data
Ask the user whether to keep or deactivate the test documents.

### Step 6: Summary
Present a summary:
- Terminologies created (with IDs and codes) — distinguish new vs. reused
- Templates created (with IDs, codes, and versions)
- Test results: all pass / any failures with details
- Ready for Phase 4 (Application Layer)

## Error Handling
If any MCP tool call fails:
- Do NOT continue to the next step
- Report the exact error returned by the MCP tool
- Diagnose: is it a data model issue (go back to Phase 2) or a WIP issue (investigate)?
- Ask the user how to proceed

## Transition to Phase 4
Once Phase 3 is complete and verified, the development-time work with MCP tools is done. Phase 4 shifts to writing application code that uses `@wip/client` and `@wip/react` at runtime. Read `docs/WIP_DevGuardrails.md` before proceeding.
