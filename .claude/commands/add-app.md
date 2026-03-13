Add a new app to the constellation. Use this after the first app is built, when adding subsequent apps (e.g., Receipt Scanner after Statement Manager).

## Why This Command Exists
Adding the 2nd, 3rd, and Nth app is where the constellation thesis is tested. Each new app should REUSE existing WIP data (terminologies, templates, documents) and CREATE cross-app references that enable new queries. This command enforces that pattern.

## Steps

1. **Run `/wip-status`** to inventory everything currently in WIP.
2. Read the relevant use case document from `docs/use-cases/` for the new app's domain context.
3. **Identify reuse opportunities** — this is the critical step:
   - Which existing terminologies are relevant? (e.g., CURRENCY, COUNTRY, PAYMENT_METHOD)
   - Which existing templates will the new app reference? (e.g., Receipt Scanner references Statement Manager's BANK_TRANSACTION template)
   - Are there existing documents the new app will link to?
   - Use MCP tools to inspect existing structures:
     - `get_template_schema(existing_template_code)` — understand the reference targets
     - `search_terms(terminology_id, query)` — check if needed terms already exist
4. Follow the standard phased process:
   - **Phase 2:** Design ONLY the new terminologies, templates, and references the new app needs. Clearly mark:
     - REUSED: existing terminologies and templates referenced as-is
     - NEW: terminologies and templates created for this app
     - CROSS-LINK: references from new templates to existing templates
   - **Phase 3:** Use MCP tools to create only the new entities. Test references to existing entities specifically.
   - **Phase 4:** Build the app using @wip/client and @wip/react.
5. **Cross-app references are the key value proposition.** When designing the data model, explicitly identify:
   - Which fields in the new app reference documents from existing apps
   - Which existing terminologies the new app reuses
   - What new cross-app queries become possible with this app's data in WIP
6. Update the ecosystem docker-compose to include the new app.
7. Verify the new app appears on the gateway portal (if gateway is deployed).

## The Network Effect Check
After the new app is operational, demonstrate at least ONE cross-app query that was impossible before this app existed. Use MCP tools to run the query:

- `query_documents` across the new template and an existing template
- Show how data from both apps combines to answer a question neither app could answer alone

This validates the constellation thesis incrementally. Document the query and its result.
