Execute Phase 1 (Exploratory) of the AI-Assisted Development process.

## Steps

1. Re-read `docs/AI-Assisted-Development.md` to refresh the full process and internalize WIP's core concepts.
2. Verify the WIP MCP server is connected and responding:
   - Call `get_wip_status` — confirms all WIP services are reachable
   - If the MCP server is not available, ask the user to configure it (see SETUP_GUIDE.md)
3. **Inventory existing data using MCP tools:**
   - Call `list_namespaces` — understand the namespace structure
   - Call `list_terminologies` — list ALL terminologies (code, name, status, term count). Output as a table.
   - Call `list_templates` — list ALL templates (code, name, status, version, field count). Output as a table.
   - Call `query_documents` for each active template to get document counts
   - Note any terminologies or templates relevant to the constellation being built
4. If the user mentions a specific use case or domain, read the relevant doc from `docs/use-cases/`.
5. Summarize findings:
   - WIP instance health status
   - Existing terminologies (highlight any reusable ones like COUNTRY, CURRENCY, GENDER)
   - Existing templates (highlight any relevant to the planned work)
   - Document counts per template
   - Readiness assessment for Phase 2

## Gate
Do NOT proceed to Phase 2 until:
- The WIP MCP server is connected and all services are healthy
- All existing terminologies and templates have been inventoried
- You can explain WIP's core concepts (terminologies, templates, documents, references, identity hashing, synonyms, bulk-first APIs)
- You have read the relevant use case documentation
