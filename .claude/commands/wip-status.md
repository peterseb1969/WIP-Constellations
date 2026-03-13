Check the current state of the WIP instance. Run this at the start of any session to rebuild your awareness of what exists.

## Why This Matters
You have no memory between sessions. Without running this command, you risk recreating terminologies or templates that already exist, or proposing data models that conflict with established structures.

## Steps

1. Verify WIP connectivity:
   - Call `get_wip_status` — confirms all services are healthy
   - If it fails, alert the user that WIP may be down

2. List ALL terminologies:
   - Call `list_terminologies`
   - Display as a table: code, name, status, number of terms

3. List ALL templates:
   - Call `list_templates`
   - Display as a table: code, name, status, version, number of fields, extends (if any)

4. Count documents per template:
   - For each active template: `query_documents(template_code, {limit: 0})`
   - Display total document count per template

5. Check for relevant ontology relationships (if any templates use ontology features):
   - Call `get_ontology_relationships` for relevant terms if applicable

6. Summarize:
   - Total terminologies (active/inactive)
   - Total templates (active/inactive)
   - Total documents
   - Any terminologies or templates that look relevant to the current task
   - Any potential reuse opportunities

## When to Run
- **Always** at the start of a new Claude Code session
- Before running `/design-model` for a new app
- Before running `/add-app` to add a constellation app
- Whenever you're unsure what state WIP is in
