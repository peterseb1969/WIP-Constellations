Execute Phase 2 (Data Model Design) of the AI-Assisted Development process.

## Prerequisites
Phase 1 must be complete. You must have:
- Verified WIP MCP server connectivity
- Inventoried all existing terminologies and templates

## Steps

1. Read the relevant use case document from `docs/use-cases/` for domain context.
2. Ask the user about their specific requirements:
   - What data do they want to store?
   - What are the entities?
   - What makes each entity unique (identity fields)?
   - What fields have controlled/repeating values (terminology candidates)?
   - Are there relationships between entities?
   - Do external systems have their own IDs (synonym candidates)?
3. If the user provides sample data (CSV, JSON, spreadsheet), analyze it:
   - Identify columns and data types
   - Detect repeating value columns (terminology candidates)
   - Identify natural keys (identity field candidates)
   - Note data quality issues
4. **Check what already exists using MCP tools.** This is critical — do not skip.
   - Call `list_terminologies` — can any existing terminology be reused?
   - Call `search_terms(terminology_id, query)` — do existing terms cover the needed values?
   - Call `get_template_schema(template_code)` for any relevant existing templates — could the new entity extend an existing template?
   - Flag reusable entities clearly in your proposal. DO NOT propose recreating anything that exists.
5. Design the data model and present it to the user as a clear proposal:

   For each terminology:
   - Code, name, description
   - Initial terms with aliases
   - Whether it already exists in WIP (reuse) or needs to be created (new)

   For each template:
   - Code, name, description
   - All fields: name, label, type, required, terminology reference, template reference
   - **Identity fields** — explain WHY these were chosen and how they affect versioning
   - References to other templates (and which must be created first)
   - Whether it extends an existing template

   Show creation order:
   - Which terminologies first
   - Which templates first (referenced before referencing)
   - Dependency diagram if complex

6. **STOP and wait for user approval.** Do not proceed to Phase 3 until the user explicitly approves the data model.

## Gate
The user must explicitly say they approve the data model. Phrases like "looks good", "go ahead", "approved" count. Questions, concerns, or "let me think about it" do NOT count — wait.
